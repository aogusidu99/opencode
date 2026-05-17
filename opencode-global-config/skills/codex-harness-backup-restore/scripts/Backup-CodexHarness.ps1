[CmdletBinding()]
param(
  [string]$CodexHome = (Join-Path $env:USERPROFILE ".codex"),
  [string]$BackupRoot,
  [string]$Version = "v1",
  [string]$Label = "",
  [switch]$CreateArchive,
  [string]$ArchivePath,
  [switch]$UploadToDrive,
  [string]$DriveFolderUrl = "https://drive.google.com/drive/folders/10-YC5YN9j3jdJBcyQOegPQhv5sTcCq1F"
)

$ErrorActionPreference = "Stop"

function Get-DefaultBackupRoot {
  $skillDir = Split-Path -Parent $PSScriptRoot
  $skillsDir = Split-Path -Parent $skillDir
  $globalConfigDir = Split-Path -Parent $skillsDir
  return Join-Path $globalConfigDir "harness-backups\codex"
}

function New-SafeName([string]$Text) {
  $next = $Text.Trim().ToLowerInvariant() -replace "[^a-z0-9._-]+", "-"
  return $next.Trim("-")
}

function Get-RelativeToCodexHome([string]$PathValue) {
  $full = [System.IO.Path]::GetFullPath($PathValue)
  $base = [System.IO.Path]::GetFullPath($CodexHome).TrimEnd("\") + "\"
  if ($full.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $full.Substring($base.Length)
  }
  return $null
}

function Get-FileEntry([string]$Layer, [string]$Source, [string]$RelativeBackup) {
  $entry = [ordered]@{
    layer = $Layer
    source = $Source
    codex_relative = Get-RelativeToCodexHome $Source
    backup_relative = $RelativeBackup
    exists = $false
    copied = $false
    sha256 = $null
    size = $null
    last_write_time_utc = $null
  }

  if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    return $entry
  }

  $target = Join-Path $script:SnapshotPath $RelativeBackup
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $target -Force
  $item = Get-Item -LiteralPath $Source
  $entry.exists = $true
  $entry.copied = $true
  $entry.sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  $entry.size = $item.Length
  $entry.last_write_time_utc = $item.LastWriteTimeUtc.ToString("o")
  return $entry
}

function Get-DirectoryEntry([string]$Layer, [string]$Source, [string]$RelativeBackup) {
  $entry = [ordered]@{
    layer = $Layer
    source = $Source
    codex_relative = Get-RelativeToCodexHome $Source
    backup_relative = $RelativeBackup
    exists = $false
    copied = $false
    file_count = 0
    total_bytes = 0
    last_write_time_utc = $null
  }

  if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    return $entry
  }

  $target = Join-Path $script:SnapshotPath $RelativeBackup
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $target -Recurse -Force
  $files = @(Get-ChildItem -LiteralPath $Source -Recurse -File -Force -ErrorAction SilentlyContinue)
  $entry.exists = $true
  $entry.copied = $true
  $entry.file_count = $files.Count
  $entry.total_bytes = ($files | Measure-Object -Property Length -Sum).Sum
  $entry.last_write_time_utc = (Get-Item -LiteralPath $Source).LastWriteTimeUtc.ToString("o")
  return $entry
}

function Get-InventoryItem([string]$PathValue) {
  $exists = $false
  $access = "ok"
  $errorMessage = $null
  try {
    $exists = Test-Path -LiteralPath $PathValue
  } catch {
    $access = "unreadable"
    $errorMessage = $_.Exception.Message
  }
  $item = $null
  if ($exists) {
    try {
      $item = Get-Item -LiteralPath $PathValue -Force
    } catch {
      $access = "unreadable"
      $errorMessage = $_.Exception.Message
    }
  }
  return [ordered]@{
    path = $PathValue
    exists = [bool]$exists
    access = $access
    error = $errorMessage
    type = if ($item -eq $null) { $null } elseif ($item.PSIsContainer) { "directory" } else { "file" }
    size = if ($item -ne $null -and -not $item.PSIsContainer) { $item.Length } else { $null }
    last_write_time_utc = if ($item -ne $null) { $item.LastWriteTimeUtc.ToString("o") } else { $null }
  }
}

function Copy-RestoreTools {
  $skillDir = Split-Path -Parent $PSScriptRoot
  $target = Join-Path $script:SnapshotPath "restore-tools"
  New-Item -ItemType Directory -Force -Path (Join-Path $target "scripts") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $target "templates") | Out-Null
  Copy-Item -LiteralPath (Join-Path $skillDir "SKILL.md") -Destination (Join-Path $target "SKILL.md") -Force
  Copy-Item -LiteralPath (Join-Path $skillDir "scripts\Backup-CodexHarness.ps1") -Destination (Join-Path $target "scripts\Backup-CodexHarness.ps1") -Force
  Copy-Item -LiteralPath (Join-Path $skillDir "scripts\Restore-CodexHarness.ps1") -Destination (Join-Path $target "scripts\Restore-CodexHarness.ps1") -Force
  Copy-Item -LiteralPath (Join-Path $skillDir "scripts\Upload-CodexHarnessArchiveToDrive.ps1") -Destination (Join-Path $target "scripts\Upload-CodexHarnessArchiveToDrive.ps1") -Force
  Copy-Item -LiteralPath (Join-Path $skillDir "templates\RESTORE.template.md") -Destination (Join-Path $target "templates\RESTORE.template.md") -Force
}

if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = Get-DefaultBackupRoot
}
if ($UploadToDrive) {
  $CreateArchive = $true
}

$now = Get-Date
$safeVersion = New-SafeName $Version
if ([string]::IsNullOrWhiteSpace($safeVersion)) { $safeVersion = "v1" }
$safeLabel = New-SafeName $Label
$snapshotId = "codex-harness-{0}-{1}" -f $now.ToString("yyyyMMdd-HHmmss"), $safeVersion
if (-not [string]::IsNullOrWhiteSpace($safeLabel)) {
  $snapshotId = "$snapshotId-$safeLabel"
}

$script:SnapshotPath = Join-Path $BackupRoot $snapshotId
New-Item -ItemType Directory -Force -Path $script:SnapshotPath | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $script:SnapshotPath "inventories") | Out-Null

$manifest = [ordered]@{
  schema = "codex-harness-backup.v1"
  snapshot_id = $snapshotId
  version = $safeVersion
  label = $Label
  created_at_local = $now.ToString("o")
  created_at_utc = $now.ToUniversalTime().ToString("o")
  source = [ordered]@{
    codex_home = [System.IO.Path]::GetFullPath($CodexHome)
    computer_name = $env:COMPUTERNAME
    username = $env:USERNAME
  }
  policy = [ordered]@{
    secret_values_copied = $false
    system_skills_copied = $false
    plugin_cache_copied = $false
    volatile_state_copied = $false
  }
  portability = [ordered]@{
    target_restore_path = "current-user-codex-home"
    target_path_source = "manifest codex_relative values are restored under the target machine CodexHome"
    portable_archive_recommended = $true
    portable_archive_file = "$snapshotId.zip"
    restore_tools_relative = "restore-tools"
    default_drive_folder_url = $DriveFolderUrl
  }
  files = @()
  directories = @()
  excluded = @()
  inventories = @()
}

$manifest.files += Get-FileEntry "memory-rules" (Join-Path $CodexHome "AGENTS.md") "memory-rules\AGENTS.md"
$manifest.files += Get-FileEntry "runtime-config" (Join-Path $CodexHome "config.toml") "runtime\config.toml"
$manifest.directories += Get-DirectoryEntry "memory-rules" (Join-Path $CodexHome "rules") "memory-rules\rules"

$skillsRoot = Join-Path $CodexHome "skills"
if (Test-Path -LiteralPath $skillsRoot -PathType Container) {
  foreach ($skill in Get-ChildItem -LiteralPath $skillsRoot -Directory -Force) {
    if ($skill.Name -eq ".system") {
      $systemSkills = @(Get-ChildItem -LiteralPath $skill.FullName -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
        [ordered]@{ name = $_.Name; path = $_.FullName; last_write_time_utc = $_.LastWriteTimeUtc.ToString("o") }
      })
      $systemInventory = Join-Path $script:SnapshotPath "inventories\system-skills.json"
      $systemSkills | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $systemInventory -Encoding UTF8
      $manifest.inventories += [ordered]@{ name = "system-skills"; backup_relative = "inventories\system-skills.json"; count = $systemSkills.Count }
      $manifest.excluded += [ordered]@{ layer = "skills"; path = $skill.FullName; reason = "system-managed skills inventory only" }
      continue
    }
    $manifest.directories += Get-DirectoryEntry "skills" $skill.FullName ("skills\{0}" -f $skill.Name)
  }
}

$rootItems = @(Get-ChildItem -LiteralPath $CodexHome -Force -ErrorAction SilentlyContinue | ForEach-Object {
  [ordered]@{
    name = $_.Name
    path = $_.FullName
    type = if ($_.PSIsContainer) { "directory" } else { "file" }
    size = if ($_.PSIsContainer) { $null } else { $_.Length }
    last_write_time_utc = $_.LastWriteTimeUtc.ToString("o")
  }
})
$rootInventory = Join-Path $script:SnapshotPath "inventories\codex-root.json"
$rootItems | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $rootInventory -Encoding UTF8
$manifest.inventories += [ordered]@{ name = "codex-root"; backup_relative = "inventories\codex-root.json"; count = $rootItems.Count }

$pluginsRoot = Join-Path $CodexHome "plugins"
$pluginItems = @()
if (Test-Path -LiteralPath $pluginsRoot -PathType Container) {
  $pluginItems = @(Get-ChildItem -LiteralPath $pluginsRoot -Force -ErrorAction SilentlyContinue | ForEach-Object {
    [ordered]@{
      name = $_.Name
      path = $_.FullName
      type = if ($_.PSIsContainer) { "directory" } else { "file" }
      last_write_time_utc = $_.LastWriteTimeUtc.ToString("o")
    }
  })
  $manifest.excluded += [ordered]@{ layer = "mcp-tools"; path = $pluginsRoot; reason = "plugin cache inventory only; config.toml records enabled plugins" }
}
$pluginInventory = Join-Path $script:SnapshotPath "inventories\plugins.json"
$pluginItems | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $pluginInventory -Encoding UTF8
$manifest.inventories += [ordered]@{ name = "plugins"; backup_relative = "inventories\plugins.json"; count = $pluginItems.Count }

$secretPaths = @(
  (Join-Path $CodexHome "auth.json"),
  (Join-Path $CodexHome "cap_sid"),
  (Join-Path $CodexHome ".sandbox-secrets"),
  (Join-Path $env:USERPROFILE ".my_secrets.env"),
  (Join-Path $env:USERPROFILE ".secrets.env"),
  (Join-Path $env:USERPROFILE ".config\mcp-google-drive\gcp-oauth.keys.json"),
  (Join-Path $env:USERPROFILE ".config\mcp-google-drive\tokens.json"),
  (Join-Path $env:USERPROFILE ".gmail-mcp\gcp-oauth.keys.json"),
  (Join-Path $env:USERPROFILE ".gmail-mcp\credentials.json"),
  (Join-Path $env:USERPROFILE ".config\mcp-gcalendar\tokens.json")
)
$secretInventory = @()
foreach ($pathValue in $secretPaths) {
  $secretInventory += Get-InventoryItem $pathValue
  $manifest.excluded += [ordered]@{ layer = "secrets-accounts"; path = $pathValue; reason = "secret/account material; path inventory only" }
}
$secretInventoryPath = Join-Path $script:SnapshotPath "inventories\secret-references.json"
$secretInventory | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $secretInventoryPath -Encoding UTF8
$manifest.inventories += [ordered]@{ name = "secret-references"; backup_relative = "inventories\secret-references.json"; count = $secretInventory.Count }

$volatilePaths = @(
  (Join-Path $CodexHome ".codex-global-state.json"),
  (Join-Path $CodexHome "logs_2.sqlite"),
  (Join-Path $CodexHome "logs_2.sqlite-shm"),
  (Join-Path $CodexHome "logs_2.sqlite-wal"),
  (Join-Path $CodexHome "state_5.sqlite"),
  (Join-Path $CodexHome "state_5.sqlite-shm"),
  (Join-Path $CodexHome "state_5.sqlite-wal"),
  (Join-Path $CodexHome "sessions"),
  (Join-Path $CodexHome "tmp"),
  (Join-Path $CodexHome ".tmp"),
  (Join-Path $CodexHome "cache")
)
foreach ($pathValue in $volatilePaths) {
  $manifest.excluded += [ordered]@{ layer = "runtime-state"; path = $pathValue; reason = "volatile state/log/cache; not part of stable harness backup" }
}

Copy-RestoreTools

$manifestPath = Join-Path $script:SnapshotPath "manifest.json"
$manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$templatePath = Join-Path (Split-Path -Parent $PSScriptRoot) "templates\RESTORE.template.md"
$restoreText = Get-Content -LiteralPath $templatePath -Encoding UTF8 -Raw
$restoreText = $restoreText.Replace("{{SNAPSHOT_ID}}", $snapshotId)
$restoreText = $restoreText.Replace("{{VERSION}}", $safeVersion)
$restoreText = $restoreText.Replace("{{LOCAL_TIME}}", $now.ToString("yyyy-MM-dd HH:mm:ss zzz"))
$restoreText = $restoreText.Replace("{{UTC_TIME}}", $now.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'"))
$restoreText = $restoreText.Replace("{{CODEX_HOME}}", [System.IO.Path]::GetFullPath($CodexHome))
$restoreText = $restoreText.Replace("{{SNAPSHOT_PATH}}", $script:SnapshotPath)
$restoreText = $restoreText.Replace("{{ARCHIVE_NAME}}", "$snapshotId.zip")
$restoreText = $restoreText.Replace("{{DRIVE_FOLDER_URL}}", $DriveFolderUrl)
$snapshotRestorePath = Join-Path $script:SnapshotPath "RESTORE.md"
$restoreText | Set-Content -LiteralPath $snapshotRestorePath -Encoding UTF8

$archiveResultPath = $null
$archiveHash = $null
$restoreGuidePath = $null
$driveUpload = $null
if ($CreateArchive) {
  if ([string]::IsNullOrWhiteSpace($ArchivePath)) {
    $ArchivePath = Join-Path $BackupRoot "$snapshotId.zip"
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ArchivePath) | Out-Null
  Compress-Archive -Path $script:SnapshotPath -DestinationPath $ArchivePath -Force
  $archiveResultPath = (Resolve-Path -LiteralPath $ArchivePath).Path
  $archiveHash = (Get-FileHash -LiteralPath $archiveResultPath -Algorithm SHA256).Hash
  "$archiveHash  $(Split-Path -Leaf $archiveResultPath)" | Set-Content -LiteralPath "$archiveResultPath.sha256" -Encoding ASCII
  $restoreGuidePath = Join-Path (Split-Path -Parent $archiveResultPath) "$snapshotId.RESTORE.md"
  Copy-Item -LiteralPath $snapshotRestorePath -Destination $restoreGuidePath -Force
  $restoreGuidePath = (Resolve-Path -LiteralPath $restoreGuidePath).Path
}

if ($UploadToDrive) {
  if ([string]::IsNullOrWhiteSpace($archiveResultPath)) {
    throw "UploadToDrive requires an archive, but no archive was created."
  }
  $uploadScript = Join-Path $PSScriptRoot "Upload-CodexHarnessArchiveToDrive.ps1"
  $driveUploadJson = & $uploadScript -ArchivePath $archiveResultPath -RestoreGuidePath $restoreGuidePath -DriveFolderUrl $DriveFolderUrl
  $driveUpload = ($driveUploadJson -join "`n") | ConvertFrom-Json
}

[pscustomobject]@{
  SnapshotId = $snapshotId
  SnapshotPath = (Resolve-Path $script:SnapshotPath).Path
  ArchivePath = $archiveResultPath
  ArchiveSha256 = $archiveHash
  RestoreGuidePath = $restoreGuidePath
  DriveFolderUrl = if ($UploadToDrive) { $DriveFolderUrl } else { $null }
  DriveUpload = $driveUpload
  Version = $safeVersion
  CreatedAtLocal = $now.ToString("o")
  BackedUpFiles = @($manifest.files | Where-Object { $_.copied }).Count
  BackedUpDirectories = @($manifest.directories | Where-Object { $_.copied }).Count
  SecretValuesCopied = $false
} | Format-List
