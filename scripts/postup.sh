#!/usr/bin/env sh
# azd postup hook (posix / sh).
# After `azd up`, print where to start so you don't have to guess which of the two
# endpoint URLs to open first (or read the README before trying it). The buyer flow
# begins at the emulator - it plays Microsoft - and hands off to the app's landing page.

emu="$SERVICE_EMULATOR_URI"
app="$SERVICE_WEB_URI"

echo ""
echo "======================================================================"
echo " Demo ready. You play all three roles - START AT THE EMULATOR."
echo "======================================================================"
echo ""
echo "  1. Marketplace (you = Microsoft)"
echo "     $emu"
echo "     Pick an offer -> Continue. It hands the app a token and opens the landing page."
echo ""
echo "  2. Landing (you = the buyer)"
echo "     Opens automatically from step 1. Review, then Activate -> Subscribed."
echo ""
echo "  3. Publisher admin (you = the publisher)"
echo "     $app/admin"
echo "     See the authoritative state. Then fire Suspend / Change plan / Unsubscribe"
echo "     from the emulator's Subscriptions tab and refresh here to watch it follow."
echo ""
echo "  App home / demo map:  $app"
echo "  Tear down when done:  azd down --purge"
echo ""
