#!/usr/bin/env sh
# azd postup hook (posix / sh).
# After `azd up`, open the app to begin the purchase demo. Activation completes
# the buyer experience; inspecting saved records and notifications is optional.

emu="$SERVICE_EMULATOR_URI"
app="$SERVICE_WEB_URI"

echo ""
echo "======================================================================"
echo " Demo ready. Open the APP to start the purchase experience."
echo "======================================================================"
echo ""
echo "  App (start here):  $app"
echo "     Choose 'Start the purchase experience'. No guide reading is required."
echo ""
echo "  Buyer flow: simulated purchase -> partner site -> activate -> result."
echo "  Optional: inspect this saved contract and try a notification."
echo ""
echo "  Emulator (Microsoft's stand-in, including on Azure):  $emu"
echo "  No real purchase/payment. Azure hosting may incur costs."
echo "  Setup and cleanup: docs/run-demo.md (Japanese: docs/run-demo.ja.md)"
echo "  After checking the environment and removal approval: azd down"
echo ""
