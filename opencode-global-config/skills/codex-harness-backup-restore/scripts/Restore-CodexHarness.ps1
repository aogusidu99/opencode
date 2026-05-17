[CmdletBinding()]
param(
  [string]$SnapshotPath,
  [string]$ArchivePath,
  [string]$CodexHome,
  [switch]$Apply,
  [switch]$PruneSkills
)

$ErrorActionPreference = "Stop"
$script:ExtractedTempRoot = $null

function Get-DefaultBackupRoot {
  $skillDir = Split-Path -Parent $PSScriptRoot
  $skillsDir = Split-Path -Parent $skillDir
  $globalConfigDir = Split-Path -Parent $skillsDir
  return Join-Path $globalConfigDir "harness-backups\codex"
}

function Get-LatestSnapshot {
  $root = Get-DefaultBackupRoot
  if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    throw "Backup root not found: $root"
  }
  $latest = Get-ChildItem -LiteralPath $root -Directory -Force |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "manifest.json") } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  if (-not $latest) {
    throw "No Codex harness snapshot found under: $root"
  }
  return $latest.FullName
}

function Join-CodexPath([string]$RelativePath) {
  if ([string]::IsNullOrWhiteSpace($RelativePath)) { return $null }
  return Join-Path $CodexHome $RelativePath
}

function Expand-SnapshotArchive([string]$PathValue) {
  $resolvedArchive = (Resolve-Path -LiteralPath $PathValue).Path
  $script:ExtractedTempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("codex-harness-restore-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $script:ExtractedTempRoot | Out-Null
  Expand-Archive -LiteralPath $resolvedArchive -DestinationPath $script:ExtractedTempRoot -Force
  if (Test-Path -LiteralPath (Join-Path $script:ExtractedTempRoot "manifest.json") -PathType Leaf) {
    return $script:ExtractedTempRoot
  }
  $snapshot = Get-ChildItem -LiteralPath $script:ExtractedTempRoot -Directory -Force |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "manifest.json") -PathType Leaf } |
    Select-Object -First 1
  if (-not $snapshot) {
    throw "No manifest.json found after extracting archive: $resolvedArchive"
  }
  return $snapshot.FullName
}

function Remove-ExtractedTemp {
  if (-not [string]::IsNullOrWhiteSpace($script:ExtractedTempRoot) -and
      (Test-Path -LiteralPath $script:ExtractedTempRoot -PathType Container)) {
    Remove-Item -LiteralPath $script:ExtractedTempRoot -Recurse -Force
  }
}

function Copy-BackedFile($Entry) {
  if (-not $Entry.copied) { return }
  $source = Join-Path $SnapshotPath $Entry.backup_relative
  $target = Join-CodexPath $Entry.codex_relative
  if (-not $target) { return }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
}

function Copy-BackedDirectory($Entry) {
  if (-not $Entry.copied) { return }
  $source = Join-Path $SnapshotPath $Entry.backup_relative
  $target = Join-CodexPath $Entry.codex_relative
  if (-not $target) { return }
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  if (Test-Path -LiteralPath $source -PathType Container) {
    Get-ChildItem -LiteralPath $source -Force | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
    }
  }
}

if (-not [string]::IsNullOrWhiteSpace($ArchivePath)) {
  $SnapshotPath = Expand-SnapshotArchive $ArchivePath
} elseif ([string]::IsNullOrWhiteSpace($SnapshotPath)) {
  $SnapshotPath = Get-LatestSnapshot
}
$SnapshotPath = (Resolve-Path -LiteralPath $SnapshotPath).Path

$manifestPath = Join-Path $SnapshotPath "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "manifest.json not found in snapshot: $SnapshotPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Encoding UTF8 -Raw | ConvertFrom-Json
if ($manifest.schema -ne "codex-harness-backup.v1") {
  throw "Unsupported snapshot schema: $($manifest.schema)"
}

if ([string]::IsNullOrWhiteSpace($CodexHome)) {
  $CodexHome = Join-Path $env:USERPROFILE ".codex"
}

$filePlan = @($manifest.files | Where-Object { $_.copied } | ForEach-Object {
  [pscustomobject]@{
    Kind = "file"
    Source = Join-Path $SnapshotPath $_.backup_relative
    Target = Join-CodexPath $_.codex_relative
  }
})
$dirPlan = @($manifest.directories | Where-Object { $_.copied } | ForEach-Object {
  [pscustomobject]@{
    Kind = "directory"
    Source = Join-Path $SnapshotPath $_.backup_relative
    Target = Join-CodexPath $_.codex_relative
  }
})

if (-not $Apply) {
  [pscustomobject]@{
    Mode = "dry-run"
    SnapshotId = $manifest.snapshot_id
    SnapshotPath = $SnapshotPath
    CodexHome = $CodexHome
    SourceCodexHome = $manifest.source.codex_home
    FilesToRestore = $filePlan.Count
    DirectoriesToRestore = $dirPlan.Count
    PruneSkills = [bool]$PruneSkills
    Message = "Re-run with -Apply to restore. Secret/account files are not restored from this snapshot."
  } | Format-List
  $filePlan + $dirPlan | Format-Table -AutoSize
  Remove-ExtractedTemp
  return
}

$backupScript = Join-Path $PSScriptRoot "Backup-CodexHarness.ps1"
$preRestoreLabel = "pre-restore-$($manifest.snapshot_id)"
Write-Host "Creating pre-restore backup..."
& $backupScript -CodexHome $CodexHome -Label $preRestoreLabel | Out-Host

foreach ($entry in $manifest.files) {
  Copy-BackedFile $entry
}

if ($PruneSkills) {
  $snapshotSkillNames = @($manifest.directories |
    Where-Object { $_.layer -eq "skills" -and $_.copied } |
    ForEach-Object { Split-Path -Leaf $_.codex_relative })
  $skillsRoot = Join-Path $CodexHome "skills"
  if (Test-Path -LiteralPath $skillsRoot -PathType Container) {
    foreach ($skill in Get-ChildItem -LiteralPath $skillsRoot -Directory -Force) {
      if ($skill.Name -eq ".system") { continue }
      if ($snapshotSkillNames -contains $skill.Name) { continue }
      Remove-Item -LiteralPath $skill.FullName -Recurse -Force
    }
  }
}

foreach ($entry in $manifest.directories) {
  Copy-BackedDirectory $entry
}

[pscustomobject]@{
  Mode = "applied"
  SnapshotId = $manifest.snapshot_id
  SnapshotPath = $SnapshotPath
  CodexHome = $CodexHome
  SourceCodexHome = $manifest.source.codex_home
  RestoredFiles = $filePlan.Count
  RestoredDirectories = $dirPlan.Count
  PrunedSkills = [bool]$PruneSkills
  SecretAccountFilesRestored = $false
} | Format-List

Remove-ExtractedTemp
