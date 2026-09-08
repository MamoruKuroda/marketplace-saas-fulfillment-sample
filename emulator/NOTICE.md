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
- **Product-first purchase experience** — `src/client/start.{html,js,css}` shows a fictional product
  detail page with catalogue-backed plans and prices. Scenario/offer controls sit in a collapsed
  presenter panel. The Web product page leads to card checkout (`web-card`) or an explicit handoff
  to Azure (`web-azure`); the portal-style product page (`azure-portal`) leads to the same Azure
  checkout. `checkout.{html,js,css}` provides distinct Web billing/card and Azure subscription/
  resource-group controls, a review step, and simulated order confirmation. Only fictional saved
  cards and Azure resources can be selected. Built-in offers use a fictional product title for the
  visual example; their actual IDs, plans and stored catalogue are unchanged.
- **Simulation boundary** — This does not collect credentials or payment data, evaluate real
  identity/RBAC/purchase policies, or assert that all routes are available for every offer. Display
  totals use catalogue currency/price, but taxes and real billing are not implemented. Contract
  period, payment and Azure project selections are presentation-only and never enter the token.
  Missing catalogue/prices and invalid selections show errors rather than replacement offers.
  A draft and confirmed synthetic purchase are stored per browser tab in session storage, so a
  language reload preserves the same Configure link. Missing drafts cannot render a completed
  order. There is no additional order-creation API request.
- **Purchase journey navigation** — `src/client/purchase-journey.js`, the map, and client navigation
  carry whitelisted `scenario` and `culture` query metadata. Discovery passes the same existing
  `offer` and `plan` IDs to `/checkout.html`; the original technical form at `/` remains directly
  accessible through presenter controls. The language toggle keeps the selected scenario/offer/
  plan and checkout draft through reloads. All discovery and
  checkout screens remain step **1**, operated by the buyer on the Microsoft stand-in side.
  After simulated confirmation, Configure opens the existing publisher landing page with a
  frozen purchase token. Repeated Configure clicks reuse that purchase. Both the new experience
  and the technical form share token serialization (UTF-8, with unchanged ASCII payload output);
  the URL API preserves the configured landing URL's query and hash.
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
- The `build-emulator` CI lane compiles TypeScript, runs Jest tests and probes startup. Deployment
  builds the container in Azure Container Registry (`remoteBuild`), without local Docker.
- npm dependencies reflect the upstream 2023 snapshot. Prefer minimal, reviewed bumps; a
  dependency changes require both CI and container build validation.
