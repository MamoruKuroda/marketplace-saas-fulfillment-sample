# NOTICE — vendored Fulfillment API Emulator

The contents of this `emulator/` directory are **vendored** (copied into this repository) from:

- **Project:** Microsoft Commercial Marketplace SaaS API Emulator
- **Source:** https://github.com/microsoft/Commercial-Marketplace-SaaS-API-Emulator
- **Commit:** `bb7bc6317128605b2f777ebe1c9969198733ae85`
- **License:** MIT (see [`LICENSE`](./LICENSE)), Copyright (c) Microsoft Corporation

## Why it's vendored (not fetched)

The upstream project is dormant (its `main` branch has had no functional change since mid-2023),
so we copy a reviewed snapshot into the repo instead of cloning it at build time. This makes the
build reproducible, lets our own Dependabot **security alerts** watch the emulator's npm
dependencies (they scan the committed `package-lock.json`), and lets us restyle its UI.

## Local modifications

Changes we made on top of the upstream snapshot:

- **`docker/Dockerfile`** — removed `RUN npm install -g npm` (the latest npm requires Node ≥ 22,
  but the base image is Node 18; the bundled npm is sufficient), and added a `.dockerignore`.
- **UI restyle** — the client assets under `src/client/` (`core.css` and the per-page CSS/HTML)
  are restyled to match this sample's app (`SaaSAgentSample.Web`) for a visually consistent demo.
  The emulator's **behavior / API surface is unchanged** — only presentation.
- **Localization** — `src/client/i18n.js` adds an EN / 日本語 catalogue and applies it to the
  existing markup through `data-i18n` attributes.
- **Demo map** — `src/client/demo-map.js` injects the same four-step map the publisher app
  shows, with the current step expanded. Steps 1 and 4 happen in this emulator, so without it
  the map could never highlight them and the app had to explain the gap in prose. The
  convention is shared: a solid card is the system you are in, a dashed one is the other side
  and opens in a new tab. Pure presentation — it reads `/api/util/config` only to find the
  publisher app's URL, and falls back to unlinked cards if that call fails.
- **Shared language** — `src/client/i18n.js` honours a `?culture=en|ja` parameter once, stores the
  choice, and strips it from the URL, so following a link from the publisher app keeps one
  language while leaving the EN / 日本語 toggle in control afterwards.
- **Illustrative discovery and checkout** — `src/client/start.{html,js,css}` adds three explicit
  demo scenarios: Marketplace Web with an own corporate card (`web-card`), Marketplace Web
  handing off to Azure purchasing (`web-azure`), and an Azure portal starting point
  (`azure-portal`). These are generic teaching assets, not copies of real storefront/portal
  screens, and contain no vendor logos, payment collection, credential collection, or actual
  identity/RBAC/purchase-policy evaluation. Availability of every route for every offer is not
  implied. The existing offer catalogue is read from `GET /api/util/offers`; missing, empty, and
  invalid selections produce explicit errors rather than invented offers.
- **Purchase journey navigation** — `src/client/purchase-journey.js`, the map, and client navigation
  carry whitelisted `scenario` and `culture` query metadata. Discovery passes the same existing
  `offer` and `plan` IDs to the original purchase form at `/`, which remains directly accessible.
  The language toggle keeps the selected scenario/offer/plan through reloads. All discovery and
  checkout screens remain step **1**, operated by the buyer on the Microsoft stand-in side.
  The existing Continue action still generates the same token once; the URL API adds that token
  alongside navigation metadata while preserving the configured landing URL's query and hash.
  Scenario metadata is not trusted purchase proof and does not change fulfillment payloads,
  purchaser IDs, quantity, prices, plans, authentication, authorization, or subscription state.
  There is no additional order-creation request. The UI states that the emulator creates its
  subscription record at Resolve, not at an actual storefront checkout. Short EN/JA route hints
  link through the map to the publisher's `#how` glossary, keeping the detailed policy explanation
  in one place. Client regression tests use the existing Jest/TypeScript runner and Node VM.
- **Demo reset** — `src/client/subscriptions.{html,js}` add a "Reset the demo" button that deletes
  every subscription here (via the emulator's existing `DELETE /api/util/publishers/...` utility
  route — no API change) and then asks the publisher app to clear its own copy. It is a
  test-harness convenience and the button says so: the real Marketplace has no way to delete a
  publisher's records. The publisher app only accepts that call when it has been configured for
  demos, and only from this origin.

## Maintenance notes

- The chrome that both surfaces share — the map, masthead, nav, and language toggle — is
  duplicated here by necessity and has drifted twice. `scripts/check-shared-ui.ps1` compares the
  values that must match and fails when they diverge; run it after touching `core.css`.
- This is a **teaching-sample stand-in for Microsoft** used only in the demo; it is not a
  production component and is torn down with `azd down`.
- We do **not** run the emulator's Node build in CI — it is built at deploy time in Azure
  Container Registry (`remoteBuild`). If you change its TypeScript (not just CSS/HTML), verify
  the build via `azd deploy emulator` or a local Docker build.
- npm dependencies reflect the upstream 2023 snapshot. Prefer minimal, reviewed bumps; a
  dependency change can break the emulator build, which CI will not catch.
