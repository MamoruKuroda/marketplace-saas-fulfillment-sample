<a id="l2-walkthrough-synthetic-fulfillment-lifecycle"></a>

# Verify the fulfillment integration

Check the partner's saved results and distinguish them from emulator/API responses.
**For purchase-demo participants, activation is the end; these checks are optional.**

> 日本語: **[l2-demo.ja.md](l2-demo.ja.md)**
>
> The filename and `SyntheticL2LifecycleTests` class retain a historical name.
> “L2” is this repository's integration-test classification, not a Marketplace tier or a demo prerequisite.
> Prepare a browser environment using [run-demo](run-demo.md); explanation is in the [implementation guide](walkthrough.md).

<a id="a-automated-synthetic-l2-recommended"></a>
<a id="automated-checks"></a>
## Automated checks and their boundaries

From the repository root:

```powershell
dotnet test SaaSAgentSample.slnx --filter "FullyQualifiedName~SyntheticL2LifecycleTests|FullyQualifiedName~PurchaseJourneyTests"
```

| Check | What it exercises | What it does not prove |
| --- | --- | --- |
| `SyntheticL2LifecycleTests` | Real Fulfillment client → HTTP emulator stub, WebApplicationFactory app, InMemory records; Resolve → Activate → ChangePlan → Suspend → Reinstate → Unsubscribe | Full Node emulator, browser checkout, real SQL persistence, live Marketplace |
| Activation within that test | Direct `LandingService` invocation that calls the external API | A click or form POST through the buyer page |
| `PurchaseJourneyTests` | Separate page/form POST, context, saved-record links, EN/JA presentation and fixed guide URL checks | A full browser executing the Node emulator |
| Emulator Jest tests | API behavior and client logic; purchase client tests use Node VM / simulated DOM | Full cross-application browser E2E |
| SQL Server integration tests | Provider-specific persistence/migrations when explicitly enabled | A different DB inside SyntheticL2; that fixture still selects InMemory |

The synthetic lifecycle checks saved partner state after the transitions and the plan-change
acknowledgement. A second test rejects an unknown operation with 403 and leaves state unchanged.
Those results are useful evidence within these boundaries, not a production certification.

For prerequisites and the broader test commands, see [develop](develop.md#build--test).
Automated tests do not leave the browser demo running afterwards.

<a id="b-manual-walkthrough-against-the-real-emulator"></a>
<a id="1-start-the-emulator"></a>
<a id="2-run-the-app-pointed-at-the-emulator"></a>
<a id="3-resolve-and-activate"></a>
## Prepare manual verification

Use [run-demo](run-demo.md) to start both components with their three connections aligned.
Use fictional data on your own isolated instance and begin at **app `/` → Start the purchase
experience → store → checkout → Continue on the partner site → Activate subscription**.
Open the same saved contract from the result. Do not start with the legacy token utility
unless you specifically want an API-only exercise.

<a id="4-drive-webhooks"></a>
<a id="manual-checks"></a>
## Optional notification and saved-state checks

From the saved contract, use **Try a change for this contract ↗** to select the same emulator
subscription. Follow UI actions supported in the current state; the names below are notification
actions, not a separate mandatory sequence for the buyer.

| Action / precondition | Expected partner record |
| --- | --- |
| Resolve a new purchase | `PendingFulfillmentStart` |
| Explicit Activate | `Subscribed` |
| ChangePlan while subscribed | New `PlanId`, still `Subscribed`; check the saved event and recorded prior plan |
| Suspend while subscribed | `Suspended` |
| Reinstate while suspended | `Subscribed` |
| Unsubscribe from an active/suspended test subscription | `Unsubscribed`; terminal for this record |
| ChangeQuantity | Event/acknowledgement, not a new quantity field in the partner domain |
| Renew | Informational event, no state change in this implementation |

Emulator subscription ID and partner record GUID are different. Follow the generated links,
not invented IDs. The partner list's Marketplace-ID filter must match exactly.
Return to the same `/admin/{guid}#history` and reload to inspect saved evidence.
If no prior plan was recorded, **Not recorded** is the expected comparison, not a guess.

Webhook delivery, handling, acknowledgement and storage are distinct steps. Inspect an error
or missing record rather than assuming an update is merely “pending.” Catalogue edits, operation
button colors, or a successful emulator HTTP response do not demonstrate partner persistence.

Standard demos relax JWT signature validation for unsigned emulator notifications; Get Operation
comparison remains. This is not verification of production webhook authentication.
Real-Marketplace validation is separate work; see the [implementation boundary](walkthrough.md#implementation-boundary).

<a id="5-tear-down"></a>
## Finish

Stop only your own processes as described in [run-demo](run-demo.md).
Do not reset all shared subscriptions for this exercise. The demo reset is a separate destructive
test utility, not a Marketplace purchasing or cancellation operation.

<a id="configuration-reference"></a>
Connection values live in [run-demo](run-demo.md#check-the-three-connections);
app settings and DB behavior live in [develop](develop.md#local-configuration).
The emulator's standalone configuration reference is [here](../emulator/docs/config.md).

<a id="sources-fetched-http-200"></a>
## References and evidence

[Official integration sources](walkthrough.md#sources) and the
[current documentation verification record](develop.md#verification-record) distinguish
specification, automated tests, manual observation, and historical screenshot evidence.
