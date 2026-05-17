[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ArchivePath,
  [Parameter(Mandatory = $true)]
  [string]$DriveFolderUrl,
  [string]$RestoreGuidePath,
  [switch]$OnlyRestoreGuide,
  [string]$TokenPath = (Join-Path $env:USERPROFILE ".config\mcp-google-drive\tokens.json"),
  [string]$OAuthCredentialsPath = (Join-Path $env:USERPROFILE ".config\mcp-google-drive\gcp-oauth.keys.json")
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Get-DriveFolderId([string]$Url) {
  if ($Url -match "/folders/([^/?#]+)") { return $Matches[1] }
  if ($Url -match "[?&]id=([^&#]+)") { return $Matches[1] }
  if ($Url -match "^[A-Za-z0-9_-]+$") { return $Url }
  throw "Cannot parse Google Drive folder id from: $Url"
}

function Get-OAuthClient($CredentialsPath) {
  $credentials = Get-Content -LiteralPath $CredentialsPath -Encoding UTF8 -Raw | ConvertFrom-Json
  if ($credentials.installed) { return $credentials.installed }
  if ($credentials.web) { return $credentials.web }
  throw "Unsupported OAuth credentials JSON shape: $CredentialsPath"
}

function Get-AccessToken($TokenPath, $OAuthCredentialsPath) {
  if (-not (Test-Path -LiteralPath $TokenPath -PathType Leaf)) {
    throw "Google Drive token file not found: $TokenPath"
  }
  if (-not (Test-Path -LiteralPath $OAuthCredentialsPath -PathType Leaf)) {
    throw "Google Drive OAuth credentials file not found: $OAuthCredentialsPath"
  }

  $token = Get-Content -LiteralPath $TokenPath -Encoding UTF8 -Raw | ConvertFrom-Json
  $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  if ($token.access_token -and $token.expiry_date -and ([int64]$token.expiry_date -gt ($nowMs + 60000))) {
    return $token.access_token
  }
  if (-not $token.refresh_token) {
    throw "Google Drive token file has no refresh_token; re-authorize Google Drive first."
  }

  $client = Get-OAuthClient $OAuthCredentialsPath
  $response = Invoke-RestMethod `
    -Method Post `
    -Uri "https://oauth2.googleapis.com/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body @{
      client_id = $client.client_id
      client_secret = $client.client_secret
      refresh_token = $token.refresh_token
      grant_type = "refresh_token"
    }

  $token.access_token = $response.access_token
  $token.token_type = $response.token_type
  $token.expiry_date = [DateTimeOffset]::UtcNow.AddSeconds([int]$response.expires_in).ToUnixTimeMilliseconds()
  $token | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $TokenPath -Encoding UTF8
  return $token.access_token
}

function Send-DriveFile($PathValue, $FolderId, $AccessToken, $MimeType) {
  Add-Type -AssemblyName System.Net.Http
  $file = Get-Item -LiteralPath $PathValue
  $metadata = @{
    name = $file.Name
    parents = @($FolderId)
  } | ConvertTo-Json -Depth 5

  $client = [System.Net.Http.HttpClient]::new()
  try {
    $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $AccessToken)
    $client.DefaultRequestHeaders.Add("X-Upload-Content-Type", $MimeType)
    $client.DefaultRequestHeaders.Add("X-Upload-Content-Length", [string]$file.Length)

    $metadataContent = [System.Net.Http.StringContent]::new($metadata, [System.Text.Encoding]::UTF8, "application/json")
    $sessionResponse = $client.PostAsync("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink", $metadataContent).GetAwaiter().GetResult()
    $sessionBody = $sessionResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $sessionResponse.IsSuccessStatusCode) {
      throw "Google Drive upload session failed: HTTP $([int]$sessionResponse.StatusCode) $sessionBody"
    }

    $uploadUrl = $sessionResponse.Headers.Location
    if (-not $uploadUrl) {
      throw "Google Drive did not return a resumable upload URL."
    }

    $stream = [System.IO.File]::OpenRead($file.FullName)
    try {
      $fileContent = [System.Net.Http.StreamContent]::new($stream)
      $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($MimeType)
      $uploadResponse = $client.PutAsync($uploadUrl, $fileContent).GetAwaiter().GetResult()
      $uploadBody = $uploadResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      if (-not $uploadResponse.IsSuccessStatusCode) {
        throw "Google Drive file upload failed: HTTP $([int]$uploadResponse.StatusCode) $uploadBody"
      }
    } finally {
      $stream.Dispose()
    }
  } finally {
    $client.Dispose()
  }

  $result = $uploadBody | ConvertFrom-Json

  return [ordered]@{
    name = $result.name
    id = $result.id
    webViewLink = $result.webViewLink
  }
}

$resolvedArchive = (Resolve-Path -LiteralPath $ArchivePath).Path
$folderId = Get-DriveFolderId $DriveFolderUrl
$accessToken = Get-AccessToken $TokenPath $OAuthCredentialsPath

$defaultRestoreGuidePath = Join-Path (Split-Path -Parent $resolvedArchive) ("{0}.RESTORE.md" -f [System.IO.Path]::GetFileNameWithoutExtension($resolvedArchive))
if ([string]::IsNullOrWhiteSpace($RestoreGuidePath) -and
    (Test-Path -LiteralPath $defaultRestoreGuidePath -PathType Leaf)) {
  $RestoreGuidePath = $defaultRestoreGuidePath
}

$uploaded = @()
if (-not $OnlyRestoreGuide) {
  $uploaded += Send-DriveFile $resolvedArchive $folderId $accessToken "application/zip"

  $hashPath = "$resolvedArchive.sha256"
  if (Test-Path -LiteralPath $hashPath -PathType Leaf) {
    $uploaded += Send-DriveFile $hashPath $folderId $accessToken "text/plain"
  }
}
if (-not [string]::IsNullOrWhiteSpace($RestoreGuidePath) -and
    (Test-Path -LiteralPath $RestoreGuidePath -PathType Leaf)) {
  $uploaded += Send-DriveFile (Resolve-Path -LiteralPath $RestoreGuidePath).Path $folderId $accessToken "text/markdown"
}

[pscustomobject]@{
  DriveFolderId = $folderId
  Uploaded = $uploaded
} | ConvertTo-Json -Depth 8
