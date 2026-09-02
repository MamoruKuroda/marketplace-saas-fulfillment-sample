# Verifies the two .resx catalogs are symmetric and that every L["..."] key used in code
# exists byte-identically in both. Run from the repo root: pwsh ./scripts/check-i18n.ps1
[CmdletBinding()]
param([string]$RepoRoot = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Stop'
$resDir = Join-Path $RepoRoot 'src/SaaSAgentSample.Web/Resources'
$neutral = Join-Path $resDir 'SharedResource.resx'
$ja = Join-Path $resDir 'SharedResource.ja.resx'

function Get-ResxKeys([string]$path) {
    $xml = [xml](Get-Content -LiteralPath $path -Raw -Encoding UTF8)
    , @($xml.root.data | ForEach-Object { $_.name })
}

$neutralKeys = Get-ResxKeys $neutral
$jaKeys = Get-ResxKeys $ja
$failures = @()

$missingInJa = @($neutralKeys | Where-Object { $_ -cnotin $jaKeys })
$missingInNeutral = @($jaKeys | Where-Object { $_ -cnotin $neutralKeys })
foreach ($k in $missingInJa) { $failures += "ja resx is missing key: [$k]" }
foreach ($k in $missingInNeutral) { $failures += "neutral resx is missing key: [$k]" }

$dupNeutral = @($neutralKeys | Group-Object | Where-Object Count -gt 1)
$dupJa = @($jaKeys | Group-Object | Where-Object Count -gt 1)
foreach ($d in $dupNeutral) { $failures += "duplicate key in neutral resx: [$($d.Name)]" }
foreach ($d in $dupJa) { $failures += "duplicate key in ja resx: [$($d.Name)]" }

# Neutral values must equal their keys (the keys ARE the English text).
$xmlNeutral = [xml](Get-Content -LiteralPath $neutral -Raw -Encoding UTF8)
foreach ($d in $xmlNeutral.root.data) {
    if ($d.value -cne $d.name) { $failures += "neutral value != key: [$($d.name)] -> [$($d.value)]" }
}

# Every L["..."] / _l["..."] literal in Razor + C# must exist in both catalogs.
$sourceFiles = Get-ChildItem -Path (Join-Path $RepoRoot 'src') -Recurse -File -Include *.cshtml, *.cs |
    Where-Object { $_.FullName -notmatch '[\\/](bin|obj)[\\/]' }
$pattern = '(?<![A-Za-z0-9_])_?[lL]\["((?:[^"\\]|\\.)*)"'
$used = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($f in $sourceFiles) {
    foreach ($m in [regex]::Matches((Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8), $pattern)) {
        $key = $m.Groups[1].Value -replace '\\"', '"' -replace '\\\\', '\'
        [void]$used.Add($key)
        if ($key -cnotin $neutralKeys) { $failures += "$($f.Name): L[] key not in neutral resx: [$key]" }
        if ($key -cnotin $jaKeys) { $failures += "$($f.Name): L[] key not in ja resx: [$key]" }
    }
}

Write-Host "neutral keys : $($neutralKeys.Count)"
Write-Host "ja keys      : $($jaKeys.Count)"
Write-Host "L[] keys used: $($used.Count)"

$orphans = @($neutralKeys | Where-Object { -not $used.Contains($_) })
if ($orphans.Count -gt 0) { Write-Host "unused (informational): $($orphans.Count)"; $orphans | ForEach-Object { Write-Host "  - [$_]" } }

if ($failures.Count -gt 0) {
    Write-Host ''
    Write-Host "i18n check FAILED ($($failures.Count)):" -ForegroundColor Red
    $failures | Sort-Object -Unique | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

Write-Host ''
Write-Host 'i18n check passed.' -ForegroundColor Green
