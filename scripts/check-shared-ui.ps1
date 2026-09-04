# The publisher app and the emulator are two separate front ends that must read as one product,
# so the chrome around the demo — the map, the masthead, the nav, the language toggle — is
# deliberately duplicated. Duplicated styling drifts: the app's type was once enlarged while the
# emulator's copy stayed at the old sizes, so the same map appeared in two different sizes
# depending on which side you were standing on.
#
# This compares the values the two copies must share and fails when they differ.
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
    @{ Name = 'step card';    App = '.stepper .step {';         Emu = '.demo-map .step {';         Props = @('min-width', 'padding', 'border-radius') }
    @{ Name = 'stepper';      App = '.stepper {';               Emu = '.demo-map .stepper {';      Props = @('gap', 'align-items') }
    @{ Name = 'step number';  App = '.stepper .n {';            Emu = '.demo-map .n {';            Props = @('width', 'height', 'font-size') }
    @{ Name = 'step label';   App = '.stepper .lbl {';          Emu = '.demo-map .lbl {';          Props = @('font-size', 'line-height', 'font-weight') }
    @{ Name = 'label sub';    App = '.stepper .lbl small {';    Emu = '.demo-map .lbl small {';    Props = @('font-size', 'font-weight') }
    @{ Name = 'description';  App = '.stepper .desc {';         Emu = '.demo-map .desc {';         Props = @('font-size', 'line-height', 'margin') }
    @{ Name = 'step meta';    App = '.step-meta {';             Emu = '.demo-map .step-meta {';    Props = @('font-size', 'gap', 'margin', 'padding-top') }
    @{ Name = 'return path';  App = '.return-path {';           Emu = '.demo-map .return-path {';  Props = @('font-size', 'gap', 'margin') }
    @{ Name = 'return badge'; App = '.return-path .rp-n {';     Emu = '.demo-map .return-path .rp-n {'; Props = @('font-size', 'padding', 'border-radius') }
    @{ Name = 'return cap';   App = '.return-path .rp-cap {';   Emu = '.demo-map .return-path .rp-cap {'; Props = @('font-size') }

    # Chrome around the map. The map matched but the frame around it did not, which is what made
    # the two surfaces look like different products even when the map itself was identical.
    @{ Name = 'body type';    App = 'body {';                   Emu = 'html {';                    Props = @('font-family') }
    @{ Name = 'masthead name'; App = '.brand {';                Emu = 'body > header h1 {';        Props = @('font-size', 'font-weight') }
    @{ Name = 'masthead side'; App = '.brand small {';          Emu = 'body > header .side-tag {'; Props = @('font-size') }
    @{ Name = 'nav link';     App = 'nav.top a {';              Emu = 'nav a {';                   Props = @('font-size') }
    @{ Name = 'lang toggle';  App = '.lang a {';                Emu = 'nav .lang a {';             Props = @('font-size', 'padding', 'border-radius') }
    @{ Name = 'lang active';  App = '.lang a.active {';         Emu = 'nav .lang a.active-lang {'; Props = @('font-weight') }
    @{ Name = 'page framing'; App = '.hero-line p {';           Emu = '.page-hint {';              Props = @('font-size') }
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
    Write-Host 'The two surfaces must read as one product. Update whichever side is behind.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'shared UI check passed.' -ForegroundColor Green
