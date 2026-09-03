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

## Maintenance notes

- This is a **teaching-sample stand-in for Microsoft** used only in the demo; it is not a
  production component and is torn down with `azd down`.
- We do **not** run the emulator's Node build in CI — it is built at deploy time in Azure
  Container Registry (`remoteBuild`). If you change its TypeScript (not just CSS/HTML), verify
  the build via `azd deploy emulator` or a local Docker build.
- npm dependencies reflect the upstream 2023 snapshot. Prefer minimal, reviewed bumps; a
  dependency change can break the emulator build, which CI will not catch.
