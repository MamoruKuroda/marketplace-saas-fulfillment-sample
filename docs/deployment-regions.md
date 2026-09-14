# Choosing a deployment region

> Japanese: [deployment-regions.ja.md](deployment-regions.ja.md)

`azd up` runs a region-guidance step before resolving the infrastructure parameters.
It uses **your azd identity**, not the Azure CLI's independently selected account.
The advisor creates no Azure resources, does not log in or change the Azure CLI's
selected subscription, and never changes SKUs. After confirmation, `azd up`
continues with the normal provisioning, SQL-permission hook, and deployment.

**This is not a free deployment profile.** The existing App Service B1, SQL S0,
ACR Basic, Emulator and logging configuration is unchanged.

## First deployment

1. Install .NET 10 SDK, azd 1.33.0 or later, Azure CLI, and its Bicep CLI.
   The subsequent SQL hook also requires sqlcmd (and PowerShell 7 on Windows).
   Set up these prerequisites yourself; the advisor does not install them.
2. Sign in with `azd auth login`, then run `azd up`.
3. Check the displayed account and subscription. If the azd environment has no
   subscription, choose one visible to the inspected azd tenants. Tenants that
   need additional authentication are reported as unverified, not silently assumed
   accessible. Token acquisition is bound explicitly to the chosen subscription's
   tenant; a different default azd environment must not determine that target.
4. Optionally choose a country/geography, or select **No preference**. Names come
   from Azure's location metadata. English/Japanese display never determines
   where data will be hosted.
5. Review the candidate results and select a region. The final confirmation
   names the region and reminds you that the unchanged configuration is billable.

The advisor filters physical regions using provider resource-type/API catalogs
and App Service's Linux tier catalog. It then sends the **actual compiled
`infra/main.bicep` template**, with the candidate location and the values from
`infra/main.parameters.json`, to subscription deployment **validate** with
`validationLevel: Provider`.

Azure evaluates the request in the target subscription/scope. Provider validation
can reject quota, policy, permissions and other configuration problems. The advisor
does not implement its own Azure Policy engine or claim to enumerate every
inherited assignment or exemption. In particular, a catalog listing is **not**
evidence of available subscription quota.

Each batch makes at most five validation calls and stops after finding three
candidates. You can request another batch without deploying anything. With no
geography preference, Azure's `Recommended` region category is ordered first,
then region names alphabetically; this is not a lowest-price or lowest-latency
ranking. Previously selected geography preferences are retained.

## Results and limitations

| Result | Meaning |
| --- | --- |
| Candidate | Provider validation passed at that time, without reported diagnostics. Not a deployment-success guarantee. |
| Blocked | A catalog exclusion or an explicit validation error, including its nested cause. |
| Unverified | Permission/query failures, timeouts, throttling, incomplete validation diagnostics or an unexpected response. Not selectable as a successful candidate. |

Checks consume API calls and may take several minutes. Validate operations can
appear in Azure activity logs, although they do not create the application's
resources. The helper only performs ARM GET requests and deployment-validation
POST requests; it never submits a deployment-create request.

Azure validation is best effort. Capacity may change after the check. ACR builds,
image pulls, application startup and the postprovision SQL-user/firewall operations
are outside this check. A successful candidate does not imply those later steps
will succeed. Query access and ARM validation permissions are required; the helper
does not bypass RBAC or fall back to template-only validation.

For example, `InternalSubscriptionIsOverQuotaForSku` with **B1 limit 0, usage 0,
required 1** means the App Service Plan is blocked. It does not identify Container
Apps or SQL as the cause, and an empty `Location:` field in that error does not
prove that the template location was unset.

## Existing environments

An existing `rg-<environment-name>` pins the advisor to that group's location,
even if the group is empty. A conflicting or missing original `AZURE_LOCATION`
stops the run instead of silently creating resources elsewhere. Equivalent
spellings are matched for catalog lookup, but the **exact original location input**
is preserved for validation and provisioning: it is hashed into resource names.
Do not reconstruct that input from Azure's normalized location string.

If a previous attempt created no resource group, another candidate can be chosen.
A remembered subscription change also stops the advisor: use a separate azd
environment rather than redirecting an existing one. Existing resources are
never deleted or migrated by this helper.

## Optional settings

Set these with `azd env set <key> <value> --environment <name>` **before** `azd up`.
The hook receives the selected environment's variables, which take precedence
over same-named OS variables.

| Setting | Meaning |
| --- | --- |
| `AZURE_SUBSCRIPTION_ID` | Explicit target subscription; otherwise chosen interactively. |
| `AZURE_TENANT_ID` | Explicit azd token tenant, useful for guest accounts. No automatic login occurs. |
| `AZURE_LOCATION` | Preferred region for a new deployment; fixed region for unattended runs. Existing resource-group location must agree, and its original parameter spelling must be retained. |
| `DEPLOYMENT_GEOGRAPHY` | Azure metadata geography name, for example `Japan`; empty means no preference. Only filters new-environment searches. |
| `DEPLOYMENT_PREFLIGHT_LANGUAGE` | `en` or `ja`; otherwise follows the process UI culture, with English as fallback. |
| `DEPLOYMENT_PREFLIGHT_ACCEPT` | `true` permits unattended confirmation, but requires an explicit subscription and region. Never chooses a new region automatically. |
| `DEPLOYMENT_PREFLIGHT_MODE` | `off` explicitly skips guidance. Normal azd validation still runs; no success result is fabricated. |

The advisor stores `AZURE_SUBSCRIPTION_ID`, `AZURE_TENANT_ID`, `AZURE_LOCATION`, the chosen geography,
and a subscription guard in the selected azd environment after confirmation.
It does not store access tokens or full ARM responses. Account identity is shown
locally; redact it before sharing a terminal screenshot. Error output redacts
GUIDs, email addresses and common credential forms.

For CI, set the subscription, location and `DEPLOYMENT_PREFLIGHT_ACCEPT=true`
in advance, and run with `AZD_NON_INTERACTIVE=true`. Do not rely on `--no-prompt`
alone to configure a script hook's input behavior. Without explicit target
settings the helper stops instead of guessing.

The registered hooks pass `--interactive` to accept azd's forwarded stdin, even
when it is a pipe rather than a console handle. This enables questions, not
automatic consent: CI/noninteractive settings still apply, cancellation and EOF
stop the helper, and it cannot be combined with `--check-only`.

Use environment settings, not `azd up --location` / `--subscription`, for this
workflow. In azd 1.33.0 those flags are applied **after** `preup`; conflicting
flags can cause azd to reject the target selected by the hook.
The advisor is attached to `up`, not to standalone `provision` or `deploy`.

### Check candidates without deploying or saving

The standalone helper accepts `--check-only`. Supply `AZURE_ENV_NAME` and an
explicit `AZURE_SUBSCRIPTION_ID` in its process environment; an explicit
`AZURE_TENANT_ID` avoids cross-tenant discovery. Optionally set
`DEPLOYMENT_GEOGRAPHY` or `AZURE_LOCATION` to constrain the check.

```bash
dotnet run --project tools/DeploymentPreflight --configuration Release -- --check-only
```

This runs one bounded candidate batch without selection prompts, saving azd
environment values, or continuing to provisioning. Exit code 0 means at least
one candidate passed; nonzero means no candidate was established or a prerequisite
failed. Regions beyond that batch remain unverified. Do not use `azd up` to run
this check-only path.

The helper currently supports this repository's subscription-scoped Bicep
layout and Azure public cloud. It does not support cross-tenant delegated
deployment, custom IaC paths/providers, or arbitrary ARM parameter expressions.
If changing those contracts, update the advisor too rather than validating a
different template/input set.

## Version and evidence

- **azd 1.33.0**: lifecycle integration reviewed against release source.
  `preup` runs before `up` parameter resolution, and azd reloads its environment
  after the hook. The helper uses `azd auth token`, a currently hidden CLI command;
  changes to that contract must be reviewed when upgrading azd.
- **Offline coverage**: the existing .NET/xUnit suite covers region filtering,
  nested errors, partial validation, authenticated ARM polling, environment
  protection and confirmation with fake CLI/HTTP responses.
- **Local SDK used for offline tests**: .NET SDK 10.0.112 on Windows ARM64.
- **Local Bicep compiler**: 0.45.15; the actual template compiles with the
  explicit location parameter and the resource-group contract used by the helper.
- **Live check-only run, 2026-09-10**: an isolated official azd 1.33.0 executable
  used the existing azd test identity on one test subscription. `australiaeast`,
  `austriaeast`, and `canadacentral` passed Provider validation.
  `brazilsouth` was rejected with App Service B1 limit 0 / required 1.
  `belgiumcentral` was excluded by the Log Analytics provider catalog.
  These are observations for that subscription at that time, not recommended
  regions or guarantees for other subscriptions. The remaining 58 regions were
  not checked in that batch.
- **Boundaries of that run**: no target was saved and no resources were created.
  It exercised the standalone check-only path, not an entire `azd up` run.
  The machine's installed azd 1.28.1 was not upgraded or reauthenticated.
- **Actual hook connection check, 2026-09-12**: ran the official azd 1.33.0
  `up` command in a session-only copy with the real helper, hook scripts and
  Bicep inputs. For safety, the fixture had no services or SQL hook, and its
  custom `up` workflow ran only `env get-value AZURE_LOCATION`. A local `postup`
  assertion compared the inherited location with the saved fixture `.env`.
  Responses were supplied over forwarded stdin, exercising the real prompts,
  ARM validation and azd environment reload rather than mocking those operations.
  Selecting and confirming `australiaeast` reached Bicep initialization and the
  read-only handoff assertion. Cancelling at the final confirmation returned
  a nonzero `azd up` exit without saving a location or reaching the downstream
  workflow. Both fixture resource groups remained absent (HTTP 404).
- That check found and fixed an input-detection issue: the hook receives
  redirected stdin, so checking `Console.IsInputRedirected` alone rejected
  otherwise valid forwarded interaction. Offline regressions now cover the
  explicit interactive mode, CI/noninteractive gates, cancellation and EOF.
- **Still unverified**: the default provision/package/publish/deploy workflow,
  actual resource creation, live policy-denial cases, SQL setup, application
  startup, and interactive behavior across all supported OS/terminal versions.
  The safe fixture's azd success message is not evidence of a cloud deployment.
  Only the fixture's local environment was written; the existing Azure login,
  resources, repository `.azure` state, and installed azd were unchanged.

## Sources

- [Azure locations and geography metadata](https://learn.microsoft.com/en-us/rest/api/resources/subscriptions/list-locations?view=rest-resources-2022-12-01)
- [App Service SKU availability](https://learn.microsoft.com/en-us/cli/azure/appservice?view=azure-cli-latest#az-appservice-list-locations)
- [Subscription deployment validation API](https://learn.microsoft.com/en-us/rest/api/resources/deployments/validate-at-subscription-scope?view=rest-resources-2025-04-01)
- [ARM preflight and limitations](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-preflight)
- [Validation levels and permissions](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-what-if)
- [Azure Policy scopes and exemptions](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/scope)
- [azd 1.33.0 preup middleware](https://github.com/Azure/azure-dev/blob/29133b640536436db9b56f8db4b1781cb136e5ba/cli/azd/cmd/middleware/hooks.go)
- [azd 1.33.0 hook environment reload](https://github.com/Azure/azure-dev/blob/29133b640536436db9b56f8db4b1781cb136e5ba/cli/azd/pkg/ext/hooks_runner.go)
