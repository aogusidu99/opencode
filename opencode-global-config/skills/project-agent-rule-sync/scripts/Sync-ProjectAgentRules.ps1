[CmdletBinding()]
param(
    [string]$ProjectDir = (Get-Location).Path,
    [ValidateSet('Check', 'Mirror')]
    [string]$Mode = 'Check',
    [ValidateSet('Auto', 'AGENTS', 'CLAUDE')]
    [string]$Source = 'Auto'
)

$ErrorActionPreference = 'Stop'

function Read-Utf8File {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

function Normalize-Text {
    param([AllowNull()][string]$Text)
    if ($null -eq $Text) {
        return $null
    }
    return ($Text -replace "`r`n", "`n").TrimEnd()
}

$resolvedProjectDir = (Resolve-Path -LiteralPath $ProjectDir).Path
$agentsPath = Join-Path $resolvedProjectDir 'AGENTS.md'
$claudePath = Join-Path $resolvedProjectDir 'CLAUDE.md'

$agentsText = Read-Utf8File -Path $agentsPath
$claudeText = Read-Utf8File -Path $claudePath
$agentsNorm = Normalize-Text $agentsText
$claudeNorm = Normalize-Text $claudeText

if ($Mode -eq 'Check') {
    $hasAgents = $null -ne $agentsText
    $hasClaude = $null -ne $claudeText

    if (-not $hasAgents -and -not $hasClaude) {
        Write-Error "Neither AGENTS.md nor CLAUDE.md exists in $resolvedProjectDir."
        exit 1
    }

    if (-not $hasAgents -or -not $hasClaude) {
        Write-Error "Project rule files are not dual-written. AGENTS.md exists: $hasAgents; CLAUDE.md exists: $hasClaude."
        exit 1
    }

    if ($agentsNorm -ne $claudeNorm) {
        Write-Error "AGENTS.md and CLAUDE.md differ in $resolvedProjectDir."
        exit 2
    }

    Write-Host "OK: AGENTS.md and CLAUDE.md are present and equivalent in $resolvedProjectDir."
    exit 0
}

if ($Mode -eq 'Mirror') {
    $sourceText = $null
    $sourceLabel = $Source

    if ($Source -eq 'AGENTS') {
        $sourceText = $agentsText
    }
    elseif ($Source -eq 'CLAUDE') {
        $sourceText = $claudeText
    }
    else {
        if ($null -ne $agentsText -and $null -eq $claudeText) {
            $sourceText = $agentsText
            $sourceLabel = 'AGENTS'
        }
        elseif ($null -eq $agentsText -and $null -ne $claudeText) {
            $sourceText = $claudeText
            $sourceLabel = 'CLAUDE'
        }
        elseif ($null -ne $agentsText -and $null -ne $claudeText -and $agentsNorm -eq $claudeNorm) {
            $sourceText = $agentsText
            $sourceLabel = 'AGENTS'
        }
        else {
            Write-Error "Auto source is ambiguous. Use -Source AGENTS or -Source CLAUDE after reviewing differences."
            exit 3
        }
    }

    if ([string]::IsNullOrWhiteSpace($sourceText)) {
        Write-Error "Selected source $sourceLabel is missing or empty."
        exit 4
    }

    Set-Content -LiteralPath $agentsPath -Value $sourceText -Encoding UTF8 -NoNewline
    Set-Content -LiteralPath $claudePath -Value $sourceText -Encoding UTF8 -NoNewline
    Write-Host "OK: mirrored $sourceLabel content to AGENTS.md and CLAUDE.md in $resolvedProjectDir."
    exit 0
}
