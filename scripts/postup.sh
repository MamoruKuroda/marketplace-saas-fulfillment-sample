#!/usr/bin/env sh
# azd postup hook (posix / sh).
# After `azd up`, tell people where to start. The app is the front door and hub:
# its home page explains the three roles and the flow, and launches step 1 (a
# purchase in the emulator, which stands in for Microsoft's marketplace). Keeping
# a single entry point avoids the "which URL first?" guesswork.

emu="$SERVICE_EMULATOR_URI"
app="$SERVICE_WEB_URI"

echo ""
echo "======================================================================"
echo " Demo ready. Open the APP to start - it's your guide and hub."
echo "======================================================================"
echo ""
echo "  App (start here):  $app"
echo "     Its home explains the three roles and the flow, and launches step 1."
echo ""
echo "  The flow (the app walks you through it):"
echo "    1. Buy in the Marketplace    - you're the buyer (opens the emulator)"
echo "    2. Activate on the landing   - you're the buyer"
echo "    3. Manage in Publisher admin - you're the publisher"
echo ""
echo "  Emulator (Microsoft's stand-in, used in steps 1 and 4):  $emu"
echo "  Tear down when done:  azd down --purge"
echo ""
