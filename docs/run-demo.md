# Prepare the demo

Prepare an environment, then **leave this document and open the app**. The
[implementation guide](walkthrough.md) explains the purchase; this page owns setup.

> 日本語: **[run-demo.ja.md](run-demo.ja.md)**
>
> Use fictional data only. No real purchase/payment occurs. Azure hosting can cost money.
> Use your own instance; do not reset a shared demo or reuse someone else's database.

## Choose an environment

| What you have | Next step |
| --- | --- |
| A working app URL from the demo operator | Open its `/` and choose **Start the purchase experience →**; no local setup |
| A local .NET/Node development environment | [Local Node setup](#local-node) |
| .NET and Docker, without local Node | [Local Docker alternative](#local-docker) |
| An authorized Azure environment for hosting your demo | [Azure demo](#azure-demo) |

**Hosting and integration target are separate choices.** Both standard local and Azure
configurations below use the vendored emulator. Deploying to Azure does not connect a real
Marketplace offer. The [real-Marketplace reference](deploy.md) requires additional implementation,
not just a different hostname or sign-in setting.

<a id="local-node"></a>
## Local Node setup

Prerequisites: Git, .NET 10 SDK, Node/npm, and a browser with JavaScript.
The emulator's Docker image and CI use Node 18; that is a compatibility baseline, not a
recommendation for a new production runtime. SQLite needs no separate DB server.
Commands assume a fresh checkout of this repository.

### 1. Build

From the repository root:

```powershell
dotnet build SaaSAgentSample.slnx
Set-Location emulator
npm ci
node .\node_modules\typescript\bin\tsc
```

On a POSIX shell, use `cd emulator` and `node node_modules/typescript/bin/tsc`.
Do not proceed after an install/build error. See [troubleshooting](#troubleshooting).

### 2. Start the emulator

In that terminal, still in `emulator`:

```powershell
$env:PORT = "3978"
$env:LANDING_PAGE_URL = "http://localhost:5134/"
$env:WEBHOOK_URL = "http://localhost:5134/api/webhook"
$env:PUBLISHER_ID = "FourthCoffee"
$env:REQUIRE_AUTH = "false"
npm start
```

POSIX equivalent:

```bash
PORT=3978 LANDING_PAGE_URL=http://localhost:5134/ \
WEBHOOK_URL=http://localhost:5134/api/webhook PUBLISHER_ID=FourthCoffee \
REQUIRE_AUTH=false npm start
```

Leave this terminal running. The emulator stores its own data under `emulator/config` by
default. Use `FILE_LOC` to select a separate state directory for an isolated run.
Create that directory and its parents before starting; the emulator does not create a
missing hierarchy recursively.
Do not set `NO_SAMPLES=true` if you want the built-in offers.

### 3. Start the partner app

In **another terminal at the repository root**:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:Fulfillment__BaseUrl = "http://localhost:3978/api"
$env:Fulfillment__PublisherId = "FourthCoffee"
$env:Landing__RequireAuthentication = "false"
$env:Fulfillment__Webhook__RequireSignedToken = "false"
dotnet run --no-launch-profile --project .\src\SaaSAgentSample.Web -- --urls http://localhost:5134
```

POSIX equivalent:

```bash
ASPNETCORE_ENVIRONMENT=Development \
Fulfillment__BaseUrl=http://localhost:3978/api Fulfillment__PublisherId=FourthCoffee \
Landing__RequireAuthentication=false Fulfillment__Webhook__RequireSignedToken=false \
dotnet run --no-launch-profile --project src/SaaSAgentSample.Web -- --urls http://localhost:5134
```

The app uses its SQLite file unless you override `Database:ConnectionString`.
For an isolated run, set `Database__Provider=Sqlite` and
`Database__ConnectionString=Data Source=<new-absolute-db-path>` in this terminal.
Use a fresh browser context as well as separate app and emulator storage; `SKIP_DATA_LOAD`
alone does not give the emulator a separate output file.

### 4. Open the app

Open **http://localhost:5134/?culture=en** (or `?culture=ja`) and choose
**Start the purchase experience →**. It opens the store in another tab.
The purchase continuation must reach the **partner app**, not emulator `/landing.html`.
Complete activation and stop at the result, or optionally inspect the same saved contract.

Starting only `dotnet run` does not start the emulator. Running an automated test does not
leave a browser storefront running.

### 5. Stop your local instance

Use Ctrl+C in each terminal you started. This stops the processes, not their saved data.
Close those dedicated terminals to discard the environment overrides.
Only remove state files you explicitly created for this run, after stopping the processes;
do not use a shared demo's all-record reset as cleanup.

<a id="local-docker"></a>
## Local Docker alternative

Use Docker for the emulator instead of steps 1–2 above; still build/run the .NET app on the host.
The Compose file also defines SQL Server, and its required password variable is interpolated
even when selecting only the emulator. Set a local-only value first; do not start SQL Server
unless you need that separate DB test.

PowerShell, from the repository root:

```powershell
$env:MSSQL_SA_PASSWORD = "<strong-local-only-value>"
docker compose run --build --rm --service-ports --name marketplace-demo-emulator `
  -e LANDING_PAGE_URL=http://localhost:5134/ emulator
```

POSIX equivalent:

```bash
MSSQL_SA_PASSWORD='<strong-local-only-value>' \
docker compose run --build --rm --service-ports --name marketplace-demo-emulator \
  -e LANDING_PAGE_URL=http://localhost:5134/ emulator
```

Use a distinct container name/ports if another instance exists. This builds the vendored
source through Compose as needed, maps host port **8080** to container port **80**, and uses
the Compose `WEBHOOK_URL=http://host.docker.internal:5134/api/webhook`.
Keep this terminal open. In the app terminal, use the app commands above but change
`Fulfillment__BaseUrl` to **`http://localhost:8080/api`**.
The landing override is essential: Compose alone does not set the partner landing URL.

Stop this container with Ctrl+C in its terminal; `--rm` removes that container and its
container-local emulator data. The app SQLite file remains. Do not use `docker compose down`
to stop unrelated SQL Server or emulator sessions.

## Check the three connections

| Connection | Local Node | Local Docker emulator | Azure demo |
| --- | --- | --- | --- |
| Partner server → API (`Fulfillment:BaseUrl`) | `http://localhost:3978/api` | `http://localhost:8080/api` | Emulator HTTPS endpoint + `/api` |
| Buyer browser → partner (`LANDING_PAGE_URL`) | `http://localhost:5134/` | `http://localhost:5134/` | Partner app HTTPS root |
| Emulator → partner (`WEBHOOK_URL`) | `http://localhost:5134/api/webhook` | `http://host.docker.internal:5134/api/webhook` | Partner app HTTPS endpoint + `/api/webhook` |

If you change a port, update all affected connections. `localhost` inside a container is
the container, not the host. Emulator `PUBLISHER_ID` and app `Fulfillment:PublisherId` must agree.
The legacy token tool and embedded API landing are not the buyer-demo entrance.

<a id="azure-demo"></a>
## Azure demo (authorized hosting only)

Prerequisites: .NET 10 SDK, Azure Developer CLI (`azd`), Azure CLI (`az`), `sqlcmd`,
and permission to create the resources and grant database access in your chosen environment.
Review [azure.yaml](../azure.yaml), [infra](../infra), and the hooks before running anything.
The emulator container is built remotely in ACR; local Docker/Node are not needed for this path.

```powershell
azd auth login
az login
azd up
```

Use the same intended tenant/subscription for both CLIs. `azd up` provisions App Service,
Azure SQL, ACR, and the emulator on Container Apps, including supporting resources.
The postprovision hook creates the app's SQL user and briefly permits the caller's public IP
through the SQL firewall; its public-IP lookup uses `api.ipify.org`.

Buyer sign-in is off in the default demo, and unsigned emulator webhook tokens are accepted.
Do not treat this as a production security configuration. Authentication changes alone do
not replace the emulator with the real Marketplace.

Open **App (start here)** from the output, not the emulator root. `azd show` can display
endpoints again. Follow the same purchase experience as locally.

<a id="sql-access"></a>
### Database access and deployment failures

If SQL-user creation fails, read the hook error and use
[the manual managed-identity SQL step](deploy.md#2-passwordless-connection-managed-identity)
after checking the intended server/database and permissions. It is a shared database step,
not an instruction to follow the real-Marketplace configuration in the rest of that reference.

Region/resource availability depends on your subscription. This document does not promise
availability or introduce a region-selection feature. Inspect errors; do not silently redirect
an existing deployment to a different environment.

### Remove an Azure demo

Only after checking the selected environment and obtaining the owner's approval:

```powershell
azd down
```

This deletes the environment's resources and can lose its contract data. It is not a buyer
subscription cancellation. Do not run it against a shared or production environment.

<a id="troubleshooting"></a>
## Troubleshooting and verification limits

| Symptom | Check |
| --- | --- |
| npm restore fails | Read the exact registry/tarball error. `npm config get registry` identifies the configured registry; lockfile download URLs may differ. Do not disable TLS or silently change dependency versions. |
| Store is unreachable | Emulator process and port; an app-only start is not enough |
| Continue opens the embedded API page | `LANDING_PAGE_URL` must point to the partner app |
| No partner record after a notification | Matching publisher/subscription, webhook reachability, response, and the saved history; reload does not prove delivery |
| Port already in use | Choose unused ports and change the three connections; do not stop someone else's processes |

Verification scope for this documentation update is recorded in
[development evidence](develop.md#verification-record). A successful local test is not proof
of Azure deployment, real purchase, or production readiness.
