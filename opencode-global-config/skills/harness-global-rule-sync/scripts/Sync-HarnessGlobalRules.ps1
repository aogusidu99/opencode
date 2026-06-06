[CmdletBinding()]
param(
    [ValidateSet('Check', 'FixJunctions')]
    [string]$Mode = 'Check',
    [string]$HarnessRoot = 'D:\Code\Harness Universal',
    [string]$ProjectDir
)

$ErrorActionPreference = 'Stop'

function Test-RuleFile {
    param(
        [string]$Path,
        [string]$Marker
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{ Path = $Path; Status = 'Missing'; Detail = 'File does not exist.' }
    }

    $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ($text -notlike "*$Marker*") {
        return [pscustomobject]@{ Path = $Path; Status = 'MissingMarker'; Detail = "Missing marker: $Marker" }
    }

    return [pscustomobject]@{ Path = $Path; Status = 'OK'; Detail = 'Rule file exists and marker is present.' }
}

function Get-LinkTargetText {
    param([System.IO.FileSystemInfo]$Item)
    if ($null -eq $Item.Target) {
        return ''
    }
    if ($Item.Target -is [array]) {
        return ($Item.Target -join ';')
    }
    return [string]$Item.Target
}

function Test-OrCreateJunction {
    param(
        [string]$SkillName,
        [string]$SourcePath,
        [string]$AgentSkillsDir,
        [string]$AgentName,
        [string]$Mode
    )

    $destPath = Join-Path $AgentSkillsDir $SkillName
    if (-not (Test-Path -LiteralPath $destPath)) {
        if ($Mode -eq 'FixJunctions') {
            New-Item -ItemType Directory -Path $AgentSkillsDir -Force | Out-Null
            New-Item -ItemType Junction -Path $destPath -Target $SourcePath | Out-Null
            return [pscustomobject]@{ Agent = $AgentName; Skill = $SkillName; Status = 'Created'; Path = $destPath; Detail = "Created junction to $SourcePath" }
        }
        return [pscustomobject]@{ Agent = $AgentName; Skill = $SkillName; Status = 'Missing'; Path = $destPath; Detail = "Expected junction to $SourcePath" }
    }

    $item = Get-Item -LiteralPath $destPath -Force
    $targetText = Get-LinkTargetText -Item $item
    $resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path

    if (($item.LinkType -eq 'Junction' -or $item.LinkType -eq 'SymbolicLink') -and $targetText -eq $resolvedSource) {
        return [pscustomobject]@{ Agent = $AgentName; Skill = $SkillName; Status = 'OK'; Path = $destPath; Detail = "Junction target: $targetText" }
    }

    return [pscustomobject]@{ Agent = $AgentName; Skill = $SkillName; Status = 'Conflict'; Path = $destPath; Detail = "Existing path is not the expected junction. LinkType=$($item.LinkType); Target=$targetText; Expected=$resolvedSource" }
}

$ruleMarker = 'Project-Level Rules and Skills'
$userProfile = $env:USERPROFILE
$ruleFiles = @(
    'C:\Users\aogus\.claude\CLAUDE.md',
    'C:\Users\aogus\.codex\AGENTS.md',
    'D:\Code\opencode\opencode-global-config\AGENTS.md',
    'C:\Users\aogus\.antigravity\AGENTS.md',
    (Join-Path $HarnessRoot 'AGENTS.md')
)

$ruleResults = foreach ($path in $ruleFiles) {
    Test-RuleFile -Path $path -Marker $ruleMarker
}

$sharedSkillsDir = Join-Path $HarnessRoot 'skills'
if (-not (Test-Path -LiteralPath $sharedSkillsDir -PathType Container)) {
    Write-Error "Shared skills directory does not exist: $sharedSkillsDir"
    exit 1
}

$sharedSkills = Get-ChildItem -LiteralPath $sharedSkillsDir -Directory | Where-Object {
    Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md') -PathType Leaf
}

$agentSkillDirs = @(
    [pscustomobject]@{ Agent = 'Codex'; Path = (Join-Path $userProfile '.codex\skills') },
    [pscustomobject]@{ Agent = 'Claude Code'; Path = (Join-Path $userProfile '.claude\skills') },
    [pscustomobject]@{ Agent = 'OpenCode'; Path = (Join-Path $userProfile '.config\opencode\skills') },
    [pscustomobject]@{ Agent = 'Antigravity'; Path = (Join-Path $userProfile '.antigravity\skills') }
)

$junctionResults = foreach ($skill in $sharedSkills) {
    foreach ($agentDir in $agentSkillDirs) {
        Test-OrCreateJunction -SkillName $skill.Name -SourcePath $skill.FullName -AgentSkillsDir $agentDir.Path -AgentName $agentDir.Agent -Mode $Mode
    }
}

$projectResults = @()
if ($ProjectDir) {
    $resolvedProjectDir = (Resolve-Path -LiteralPath $ProjectDir).Path
    $projectSkillsDir = Join-Path $resolvedProjectDir '.agents\skills'
    $projectAgents = Join-Path $resolvedProjectDir 'AGENTS.md'
    $projectClaude = Join-Path $resolvedProjectDir 'CLAUDE.md'

    if (Test-Path -LiteralPath $projectSkillsDir -PathType Container) {
        $projectSkills = Get-ChildItem -LiteralPath $projectSkillsDir -Directory
        foreach ($skill in $projectSkills) {
            $skillFile = Join-Path $skill.FullName 'SKILL.md'
            $hasSkillFile = Test-Path -LiteralPath $skillFile -PathType Leaf
            $agentsText = if (Test-Path -LiteralPath $projectAgents -PathType Leaf) { Get-Content -LiteralPath $projectAgents -Raw -Encoding UTF8 } else { '' }
            $claudeText = if (Test-Path -LiteralPath $projectClaude -PathType Leaf) { Get-Content -LiteralPath $projectClaude -Raw -Encoding UTF8 } else { '' }
            $isReferenced = (($agentsText -like "*$($skill.Name)*" -or $agentsText -like "*.agents/skills*") -and ($claudeText -like "*$($skill.Name)*" -or $claudeText -like "*.agents/skills*"))
            $status = if ($hasSkillFile -and $isReferenced) { 'OK' } elseif (-not $hasSkillFile) { 'MissingSKILL' } else { 'NotReferenced' }
            $projectResults += [pscustomobject]@{ Project = $resolvedProjectDir; Skill = $skill.Name; Status = $status; Path = $skill.FullName; Detail = 'Project .agents/skills compatibility check.' }
        }
    }
}

Write-Host 'Rule file results:'
$ruleResults | Format-Table -AutoSize | Out-String | Write-Host

Write-Host 'Shared skill junction results:'
$junctionResults | Format-Table -AutoSize | Out-String | Write-Host

if ($projectResults.Count -gt 0) {
    Write-Host 'Project skill compatibility results:'
    $projectResults | Format-Table -AutoSize | Out-String | Write-Host
}

$hasFailure = @($ruleResults | Where-Object { $_.Status -ne 'OK' }).Count -gt 0
$hasFailure = $hasFailure -or (@($junctionResults | Where-Object { $_.Status -ne 'OK' -and $_.Status -ne 'Created' }).Count -gt 0)
$hasFailure = $hasFailure -or (@($projectResults | Where-Object { $_.Status -ne 'OK' }).Count -gt 0)

if ($hasFailure) {
    exit 2
}

exit 0
