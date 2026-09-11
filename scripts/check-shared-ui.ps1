# The teaching map shares readable typography across separate systems. Product headers,
# navigation, palettes and shapes intentionally differ to show responsibility boundaries.
# Do not enforce a single-product appearance across Microsoft, buyer and operator areas.
# Run from the repo root: pwsh ./scripts/check-shared-ui.ps1
[CmdletBinding()]
param([string]$RepoRoot = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Stop'

$appCssPath = Join-Path $RepoRoot 'src/SaaSAgentSample.Web/wwwroot/css/site.css'
$emuCssPath = Join-Path $RepoRoot 'emulator/src/client/core.css'
$appCss = Get-Content -LiteralPath $appCssPath -Raw -Encoding UTF8
$emuCss = Get-Content -LiteralPath $emuCssPath -Raw -Encoding UTF8

# Each row: a human name, the app's selector, the emulator's selector, and the properties that
# must match. Colours are excluded on purpose — the two sides use different palettes by design.
$rules = @(
    @{ Name = 'step number';  App = '.stepper .n {';            Emu = '.demo-map .n {';            Props = @('font-size') }
    @{ Name = 'step label';   App = '.stepper .lbl {';          Emu = '.demo-map .lbl {';          Props = @('font-size', 'line-height', 'font-weight') }
    @{ Name = 'body type';    App = 'body {';                   Emu = 'html {';                    Props = @('font-family') }
)

function Get-Declaration([string]$css, [string]$selector, [string]$prop) {
    # Both files restyle upstream rules by redeclaring them later, so a selector can appear more
    # than once. Take the last declaration, which is the one the browser actually applies —
    # reading only the first reported false mismatches against rules that were already overridden.
    $value = $null
    $from = 0
    while ($true) {
        $i = $css.IndexOf($selector, $from, [System.StringComparison]::Ordinal)
        if ($i -lt 0) { break }
        $from = $i + $selector.Length
        $close = $css.IndexOf('}', $i)
        if ($close -lt 0) { break }
        $body = $css.Substring($i, $close - $i)
        $m = [regex]::Match($body, '(?<![a-z-])' + [regex]::Escape($prop) + '\s*:\s*([^;]+)')
        if ($m.Success) {
            $value = Resolve-Vars $css (($m.Groups[1].Value -replace '\s+', ' ').Trim())
        }
    }

    if ($null -eq $value) { return $null }
    # Font stacks are equivalent whether or not they are written with spaces after the commas.
    return ($value -replace '\s*,\s*', ',')
}

# The two files use different custom properties for the same value (the app has --radius, the
# emulator writes 10px), so compare what they resolve to rather than how they are spelled.
function Resolve-Vars([string]$css, [string]$value) {
    return [regex]::Replace($value, 'var\((--[a-z0-9-]+)\)', {
        param($m)
        $decl = [regex]::Match($css, [regex]::Escape($m.Groups[1].Value) + '\s*:\s*([^;]+)')
        if ($decl.Success) { ($decl.Groups[1].Value -replace '\s+', ' ').Trim() } else { $m.Value }
    })
}

$failures = @()
$compared = 0
foreach ($rule in $rules) {
    foreach ($prop in $rule.Props) {
        $a = Get-Declaration $appCss $rule.App $prop
        $e = Get-Declaration $emuCss $rule.Emu $prop
        $compared++
        if ($null -eq $a) { $failures += "$($rule.Name): '$prop' not found in the app ($($rule.App))"; continue }
        if ($null -eq $e) { $failures += "$($rule.Name): '$prop' not found in the emulator ($($rule.Emu))"; continue }
        if ($a -cne $e) { $failures += "$($rule.Name): '$prop' is '$a' in the app but '$e' in the emulator" }
    }
}

Write-Host "compared $compared shared declarations across the app and the emulator"

if ($failures.Count -gt 0) {
    Write-Host ''
    Write-Host "shared UI check FAILED ($($failures.Count)):" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host ''
    Write-Host 'Keep teaching-map type readable and consistent; product surfaces must remain distinct.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'shared UI check passed.' -ForegroundColor Green
