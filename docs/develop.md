# Develop locally

Build, configure, and change the implementation. To prepare the full browser experience,
use **[Prepare the demo](run-demo.md)**; to understand it, use the [implementation guide](walkthrough.md).

> 日本語: **[develop.ja.md](develop.ja.md)**

## Prerequisites

- .NET 10 SDK; see [global.json](../global.json).
- SQLite is the default in [appsettings.json](../src/SaaSAgentSample.Web/appsettings.json).
  It needs no DB server, including on arm64.
- Node/npm is needed only for emulator development, or Docker for its container alternative.
  See [demo preparation](run-demo.md#local-node).
- SQL Server testing is optional. The Compose SQL Server 2022 image is an x86-64 path;
  do not require it merely to try the demo.

## Build & test

From the repository root:

```powershell
dotnet build SaaSAgentSample.slnx
dotnet test SaaSAgentSample.slnx
```

SQL Server integration tests skip when `SQL_SERVER_CONNECTION` is not set.
The [integration verification guide](l2-demo.md#automated-checks) explains which checks use
InMemory, real HTTP, form POSTs, or the emulator; these are not interchangeable proofs.

For emulator changes, install/build as in [run-demo](run-demo.md#local-node), then run
`npm test -- --runInBand` from `emulator`. CI also checks startup on Node 18.

<a id="run-the-app"></a>
## Local configuration

Start commands, separate terminals and ports live in [run-demo](run-demo.md).
Settings bind from `appsettings*.json` and environment variables (`__` separates nested keys).
Use placeholders in source, not real IDs or credentials.

| Setting | Purpose / default |
| --- | --- |
| `Database:Provider` | `Sqlite` by default; `SqlServer` or `InMemory` can be selected |
| `Database:ConnectionString` | SQLite file by default; explicitly select separate storage for isolated runs |
| `Landing:RequireAuthentication` | `false` in Development; `true` in base settings |
| `AzureAd:*` | Optional buyer/operator sign-in configuration; not the outbound API token provider |
| `Fulfillment:BaseUrl` | Development: `http://localhost:3978/api`; base settings: real API URL, **not a complete real-API implementation** |
| `Fulfillment:PublisherId` | Token-free emulator publisher; match emulator `PUBLISHER_ID` |
| `Fulfillment:ApiVersion` | `2018-08-31` |
| `Fulfillment:Webhook:RequireSignedToken` | `false` in Development and standard Azure demo; base settings `true` |
| `Fulfillment:Webhook:Audience`, `ExpectedAppId`, `MetadataAddress` | Webhook validation settings, not API access-token acquisition |

The existing [DevNull provider](../src/SaaSAgentSample.Fulfillment/DevNullMarketplaceTokenProvider.cs)
returns no API token. See the [implementation boundary](walkthrough.md#implementation-boundary)
before treating a settings change as a real-Marketplace integration.

| Route | Purpose |
| --- | --- |
| `/` without a token | Demo start page |
| `/?token=<purchase-token>` | Buyer landing; form POST explicitly activates |
| `/admin`, `/admin/{guid}` | Saved partner contracts; management UI is an example |
| `POST /api/webhook` | Notification receiver |

The app supports EN / 日本語. The language switch overrides the browser default and preserves
purchase context; its labels are not authorization rules.

## Database providers and migrations

| Provider | Storage behavior |
| --- | --- |
| `Sqlite` (default) | `EnsureCreated()`; no separate SQLite migration history |
| `SqlServer` | Runs EF Core migrations from `src/SaaSAgentSample.Data/Persistence/Migrations` |
| `InMemory` | Tests only; not a durable contract store |

After a schema change, an existing SQLite file is not upgraded by `EnsureCreated()`.
Choose a new disposable file for local experiments rather than deleting another user's data.
SQL Server is the migration-tested provider, not the authority for Microsoft's commercial billing.

### Optional SQL Server tests

Use your own local SQL instance. For the bundled container, set a strong local-only
`MSSQL_SA_PASSWORD` in your terminal or a gitignored `.env` based on [.env.example](../.env.example),
then start only that service:

```powershell
docker compose up -d sqlserver
$env:SQL_SERVER_CONNECTION = "Server=localhost,1433;Database=SaasAgentSample;User Id=sa;Password=<local-password>;TrustServerCertificate=True;"
dotnet test SaaSAgentSample.slnx
```

POSIX uses `export SQL_SERVER_CONNECTION='...'`. Do not pass production credentials.
Stop only the SQL container you started (`docker compose stop sqlserver` for this instance);
its named data volume remains. Synthetic lifecycle tests still explicitly use InMemory,
even in the CI job where SQL Server is available.

<a id="prove-it-end-to-end-l2"></a>
## Verify the integration

[Integration verification](l2-demo.md) owns the automated selectors, expected saved outcomes,
and manual notification checks. The historical `L2` path/test class remains for compatibility;
it is not a term demo participants need to learn.

## Maintain the docs with the UI

Update EN/JA together: scope, steps, screenshots, link targets, and preserved anchors.
Use rendered Razor/HTML and their active resources for UI labels; use implementation/tests
for behavior and official sources for Marketplace requirements.

`scripts/check-i18n.ps1` checks app resource keys, not prose translation.
`scripts/check-shared-ui.ps1` checks selected CSS properties, not screenshots or documentation links.
The current CI jobs build/test .NET, the emulator and Bicep; they do not prove documentation freshness.
Check relative file links, heading anchors, image references and language counterparts when editing docs.
Keep `docs/walkthrough*.md` reachable by the demo's fixed guide URLs, without query data.

<a id="screenshots-and-evidence"></a>
### Screenshots and evidence

The current README/guide reference `experience-*` and `boundary-*` screenshots under
`docs/images/screenshots`. Keep their filenames stable. The older `en-1-*` / `ja-1-*` sets and
unused diagrams remain historical assets, not the current UI specification.
For a new capture, record the source commit, language, hosting, storage/fixture conditions and
whether the image shows an actual rendered UI or a mockup. Do not include real tokens or customer data.

<details>
<summary>Existing image provenance — #101 / b5e5963 snapshot</summary>

The screenshots used here were captured from the real sample UI using synthetic data and an
isolated HTTP fixture for the emulator APIs. They are not evidence of a complete Node emulator
integration or a real purchase. The recorded targeted checks were journey 37, experience 14,
checkout 18 and subscription selection 10; that was not the full Jest suite.
That work environment reported an npm feed 404 and unavailable Docker. These are historical
conditions of that capture, not requirements or permanent limitations of this repository.

</details>

Mermaid in the referencing document is the source for inline figures; for referenced PNG
diagrams keep the matching `.mmd` and PNG consistent. Do not bulk-move `images` merely to rename
it `assets`. A missing in-repo reference does not prove an image has no external consumers.

<a id="verification-record"></a>
### Verification record for this update

Verified on 2026-09-12 against the unchanged application/emulator code at `b5e5963`:

| Evidence | Scope |
| --- | --- |
| Local browser | Windows ARM64, .NET SDK 10.0.112, Node 24.13.0, headless Chromium; full Node emulator, separate SQLite DB and emulator state, dedicated ports |
| Purchase and saved result | EN and JA × `web-card`, `web-azure`, `azure-portal`: purchase → partner handoff → explicit activation → saved contract |
| Optional notification | Suspend on the same contract, partner state and history, in both languages on `web-card` |
| Automated checks | 36 targeted .NET lifecycle/page tests; all 129 emulator Jest tests (15 suites) |

The fixed guide URL, language selection and absence of query data were checked without opening
the external guide or forwarding tokens. The full-emulator observations above do not change the
older screenshots' HTTP-fixture provenance.

The local npm feed initially returned a tarball 404. Caching that locked package through the
configured feed's correct path allowed an offline restore with integrity checks; dependency
versions and the lockfile were unchanged. This is a verification-environment note, not a
required registry configuration for other users.

Docker, POSIX execution, Node 18 execution, SQL Server and Azure deployment were **not executed**
for this update. Their instructions were inspected against configuration, not claimed as
end-to-end verified. No shared demo, real purchase or production-readiness assessment was involved.

## See also

- [README](../README.md) — value, preview and document map.
- [Prepare the demo](run-demo.md) — environment setup and shutdown.
- [Implementation guide](walkthrough.md) — explanation and additional product work.
- [Integration verification](l2-demo.md) — test scope and saved evidence.
- [Real-Marketplace reference](deploy.md) — incomplete connection examples, not the demo recipe.
