#!/usr/bin/env pwsh
# azd postup hook (Windows / pwsh).
# After `azd up`, print where to start so you don't have to guess which of the two
# endpoint URLs to open first (or read the README before trying it). The buyer flow
# begins at the emulator — it plays Microsoft — and hands off to the app's landing page.
$ErrorActionPreference = 'SilentlyContinue'

$emu = $env:SERVICE_EMULATOR_URI
$app = $env:SERVICE_WEB_URI

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Demo ready. You play all three roles - START AT THE EMULATOR." -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Marketplace (you = the buyer)"
Write-Host "     $emu"
Write-Host "     Pick an offer -> Continue. It hands the app a token and opens the landing page."
Write-Host ""
Write-Host "  2. Landing (you = the buyer)"
Write-Host "     Opens automatically from step 1. Review, then Activate -> Subscribed."
Write-Host ""
Write-Host "  3. Publisher admin (you = the publisher)"
Write-Host "     $app/admin"
Write-Host "     See the authoritative state. Then fire Suspend / Change plan / Unsubscribe"
Write-Host "     from the emulator's Subscriptions tab and refresh here to watch it follow."
Write-Host ""
Write-Host "  App home / demo map:  $app"
Write-Host "  Tear down when done:  azd down --purge"
Write-Host ""
