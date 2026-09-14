#!/usr/bin/env pwsh
# azd postup hook (Windows / pwsh).
# After `azd up`, open the app to begin the purchase demo. Activation completes
# the buyer experience; inspecting saved records and notifications is optional.
$ErrorActionPreference = 'SilentlyContinue'

$emu = $env:SERVICE_EMULATOR_URI
$app = $env:SERVICE_WEB_URI

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Demo ready. Open the APP to start the purchase experience." -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  App (start here):  $app"
Write-Host "     Choose 'Start the purchase experience'. No guide reading is required."
Write-Host ""
Write-Host "  Buyer flow: simulated purchase -> partner site -> activate -> result."
Write-Host "  Optional: inspect this saved contract and try a notification."
Write-Host ""
Write-Host "  Emulator (Microsoft's stand-in, including on Azure):  $emu"
Write-Host "  No real purchase/payment. Azure hosting may incur costs."
Write-Host "  Setup and cleanup: docs/run-demo.md (Japanese: docs/run-demo.ja.md)"
Write-Host "  After checking the environment and removal approval: azd down"
Write-Host ""
