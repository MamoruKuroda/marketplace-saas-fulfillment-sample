#!/usr/bin/env pwsh
# azd postup hook (Windows / pwsh).
# After `azd up`, tell people where to start. The app is the front door and hub:
# its home page explains the three roles and the flow, and launches step 1 (a
# purchase in the emulator, which stands in for Microsoft's marketplace). Keeping
# a single entry point avoids the "which URL first?" guesswork.
$ErrorActionPreference = 'SilentlyContinue'

$emu = $env:SERVICE_EMULATOR_URI
$app = $env:SERVICE_WEB_URI

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Demo ready. Open the APP to start - it's your guide and hub." -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  App (start here):  $app"
Write-Host "     Its home explains the three roles and the flow, and launches step 1."
Write-Host ""
Write-Host "  The flow (the app walks you through it):"
Write-Host "    1. Buy in the Marketplace    - you're the buyer (opens the emulator)"
Write-Host "    2. Activate on the landing   - you're the buyer"
Write-Host "    3. Manage in Publisher admin - you're the publisher"
Write-Host ""
Write-Host "  Emulator (Microsoft's stand-in, used in steps 1 and 4):  $emu"
Write-Host "  Tear down when done:  azd down --purge"
Write-Host ""
