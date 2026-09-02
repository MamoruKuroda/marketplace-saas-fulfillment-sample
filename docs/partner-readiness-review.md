# Partner readiness review

**Assessed:** 2026-07-28  
**Reviewer:** GitHub Copilot (issue #67)  
**Scope:** `MamoruKuroda/marketplace-saas-fulfillment-sample` (assessed while named
`marketplace-saas-agent-sample`) — a Microsoft Commercial Marketplace
Tier-1 flat-rate SaaS reference implementation on .NET 10. Reviewed through the eyes of a
partner engineer or PM deciding whether to adopt or learn from this sample.

---

## P0 — Expectation / honesty

### P0-1 Repo name vs. contents: no agent / LLM code in `src/`

**What:** The repository is named `marketplace-saas-agent-sample` and its founding design included
an LLM tool-calling layer (promotable to Azure AI Foundry Agent Service) as a core element.
However `src/` contains only the fulfillment plane — the landing page, webhook, state store, and
publisher admin. Neither the `README.md` nor `README.ja.md` mentioned the agent layer at all:
not its intent, not its planned scope, not why v0 omits it.

**Why it matters to a partner:** A partner engineer or PM who arrives looking for the agent finds
nothing and no explanation. The mismatch between the name and the delivered content creates an
immediate trust gap. First impression is a critical filter for whether a partner adopts a sample.

**Recommendation:** Add a short, honest "Agent layer — planned, not yet built" section to both
`README.md` and `README.ja.md`. Explain the founding design intent (fulfillment APIs naturally
map to LLM tool calls), that v0 is the fulfillment plane only, and what the agent layer will add
when built.

**Status: Fixed in this PR.** Both READMEs now carry the section.

**Update (2026-09-02) — resolved differently.** The name/content gap was closed from the other
side: the repository was renamed to `marketplace-saas-fulfillment-sample`, which describes what
`src/` actually contains, and the "Agent layer — planned, not yet built" section was removed from
both READMEs. The sample no longer promises an agent layer, so there is nothing left to explain.

---

## P1 — Public-repo hygiene and first impression

### P1-1 Secrets / PII sweep

**What:** Every file was checked for real tenant IDs, UPNs, subscription IDs, publisher / Entra
app IDs, connection strings, GUIDs, or bearer tokens.

**Findings:**

| Location | Value | Verdict |
| --- | --- | --- |
| `infra/resources.bicep` | `7f951dda-4ed3-4680-a7ca-43fe172d538d` | **Public constant** — AcrPull built-in Azure RBAC role definition ID. |
| `infra/resources.bicep` | `20e940b3-4c07-4bc1-a733-45f7c7a3d0e3` | **Public constant** — Microsoft's Commercial Marketplace AAD application ID. Documented in the official [webhook validation docs](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/pc-saas-fulfillment-webhook) (verified HTTP 200). Not a secret. |
| `appsettings.json` | `REPLACE_WITH_LANDING_APP_CLIENT_ID` | Placeholder only. ✅ |
| `appsettings.json` | `REPLACE_WITH_PUBLISHER_APP_CLIENT_ID` | Placeholder only. ✅ |
| `.env.example` | `ChangeMe_Local_Dev_1` | Sample password for local dev only; `.env` is `.gitignore`d. ✅ |

No real tenant IDs, UPNs, subscription IDs, connection strings, or secrets found anywhere in
source control.

**Status: Clean.** No action needed.

### P1-2 README ↔ shipped UX drift

**What:** Verified that the README's described flow, the wayfinding stepper, the activation
banner, the 3↔4 loop, and the publisher admin match what the application actually renders.

**Findings:**

- The four-step wayfinding stepper (`_DemoMap.cshtml`) renders steps 1–4 with labels that match
  the README's numbered list exactly.
- The activation banner (green callout) fires on step 2 and correctly describes the next step
  (step 3: publisher admin) and the 3↔4 loop.
- The admin page (`/admin`) shows the lifecycle explainer, the 3↔4 loop banner when the emulator
  URL is configured, and the subscription table — all matching the README description.
- The architecture diagram in `README.md` matches the code's project structure and data flow.
- The terminology table (Tier-1, v0, L2, Synthetic L2) matches usage throughout the docs and code.

**Status: Accurate.** No drift found.

### P1-3 Evaluate-without-deploy

**What:** A partner may not run `azd up` or `dotnet run`. Can they judge the UX from the README
alone?

**Findings:** The README has no screenshots, GIF, or annotated images of the running UI. The
`docs/images/` directory contains architecture/lifecycle PNGs but they are Japanese-language-only
diagrams — not app screenshots. There is no way for a partner to see the app UX without running it.

**Status: Open gap.** This is a meaningful partner-impression risk for a public teaching sample.

**Recommendation:** Add annotated screenshots (or a short GIF) of the key screens to the README
or a `docs/screenshots.md`. Minimum useful set:

1. The home "Start here" page (three-role orientation + CTA).
2. The buyer landing / activation card (subscription details + Activate button).
3. The activation success banner with the 3↔4 loop prompt.
4. The publisher admin with a Subscribed-state subscription.

Screenshots cost little to maintain for a teaching sample and dramatically improve first
impression. This item is out of scope for the current PR (no deploy / no running app) but is
raised as a tracked recommendation.

### P1-4 License / attribution

**What:** Verify `LICENSE` (MIT) and the vendored emulator's `NOTICE.md` / attribution to
`microsoft/Commercial-Marketplace-SaaS-API-Emulator`.

**Findings:**

- `LICENSE`: MIT, copyright 2026 MamoruKuroda. ✅
- `emulator/NOTICE.md`: Correctly attributes the upstream project, links to the GitHub source,
  pins the exact upstream commit hash (`bb7bc63`), reproduces the MIT copyright, and documents
  all local modifications (Dockerfile and UI restyle). ✅
- `emulator/LICENSE`: MIT license file present. ✅
- `README.md` and `README.ja.md`: Both mention the SaaS Accelerator (MIT, reference only) and
  the Fulfillment API Emulator (MIT, vendored) with their licenses and source links. ✅

**Status: Complete.** Attribution is thorough and honest.

---

## P1 / P2 — UX and accessibility

### P1-A Accessibility

**What:** Color-only meaning (state badges, stepper current step), contrast on banners,
`aria` attributes on the compact stepper and language toggle, keyboard / focus order, `lang`
correctness.

**Findings:**

**1. `aria-current` missing on stepper steps (compact and expanded)**

`_DemoMap.cshtml` sets `class="step current"` on the active step but did not set
`aria-current="step"`. A screen-reader user navigating the stepper could not tell which step
is current.

**2. `aria-current` missing on active nav links and language toggle**

`_Layout.cshtml` used a CSS `.active` class to style the current nav item and the active language,
but neither the `<nav>` links nor the language toggle links carried an `aria-current` attribute.
Screen readers could not programmatically identify the current page or current language.

**3. Badge color + text label (not color-only)**

State badges (`.badge.subscribed/suspended/unsubscribed/pending`) use both a colored circle
(`::before`) **and** the state text label (e.g., "Subscribed"). Color is not the only indicator. ✅

**4. Contrast ratios (measured)**

| Element | Background | Foreground | Ratio | WCAG AA |
| --- | --- | --- | --- | --- |
| Success banner | `#dff6dd` | `#0e5a0e` | ~7.8:1 | ✅ |
| Info notice | `#eff6fc` | `#0f4a8a` | ~8.1:1 | ✅ |
| `.who.ms` chip | `#f3f0fa` | `#5c2e91` | ~8.0:1 | ✅ |
| `.who.pub` chip | `#eff6fc` | `#0f6cbd` | ~4.9:1 | ✅ |
| `.who.buyer` chip | `#e8f6f2` | `#0f7b6c` | ~4.4:1 | ⚠️ Just below 4.5:1 for small text |

**5. `lang` attribute**

Correctly set to `"en"` or `"ja"` in `_Layout.cshtml` based on `CultureInfo.CurrentUICulture`.
The JavaScript `site.js` language-swap also updates `document.documentElement.lang`. ✅

**6. Keyboard / focus**

Standard browser focus order throughout. No custom `tabindex` disruptions found. ✅

**Recommendations:**

- **P1 fix (implemented in this PR):** Add `aria-current="step"` to the current step in
  `_DemoMap.cshtml` and `aria-current="page"` to the active nav links and `aria-current="true"`
  to the active language in `_Layout.cshtml`.
- **P2 suggestion (open):** Darken `.who.buyer` text from `#0f7b6c` to `#0a6558` (or equivalent)
  to clear the 4.5:1 WCAG AA threshold at 0.72rem.

### P1-B First-run clarity

**What:** Is the app-as-front-door plus three-role flow obvious to a first-timer? Any dead-ends
or ambiguous CTAs?

**Findings:**

- The home "Start here" page clearly explains the three roles (Microsoft/Marketplace, Publisher /
  This App, Buyer) with role chips, role descriptions, and a primary CTA ("Step 1 — buy in the
  Marketplace").
- When the emulator URL is not configured, the home page shows a `<p class="notice">` fallback
  that gives a clear alternative instruction.
- The four-step stepper provides continuous wayfinding and highlights the current step.
- The activation success banner clearly describes the next step and the 3↔4 loop.
- The admin page's lifecycle explainer (`<details>`) describes who initiates each transition
  without assuming prior knowledge.

**Status: Clear.** No dead-ends or ambiguous CTAs found.

### P1-C EN / JA parity

**What:** Both languages complete and natural across app + docs; no fallback to English and no
mojibake.

**Findings:**

- `SharedResource.resx` and `SharedResource.ja.resx` both contain **109 localizable string
  keys** — exact parity. ✅
- `README.md` and `README.ja.md` are structurally equivalent sections. ✅
- All `docs/*.md` files have Japanese equivalents (`*.ja.md`):
  `deploy.ja.md`, `develop.ja.md`, `l2-demo.ja.md`, `walkthrough.ja.md`. ✅
- `lang` attribute is set correctly per culture. ✅
- The emulator UI (vendored from upstream) is English-only, consistent with the upstream project.
  The Japanese README notes this implicitly via the demo steps in Japanese. Acceptable for a demo
  teaching sample.

**Status: Complete.** EN/JA parity is thorough.

---

## P2 — Implementation depth

### P2-1 Test coverage

**What:** Test coverage of the real flows (Resolve→Activate, webhook validation, state
transitions, admin) and error / edge states.

**Findings:**

Test projects are organized in seven directories covering:
- `Admin/` — publisher admin page
- `Fulfillment/` — Fulfillment/Operations API client
- `L2/` — end-to-end lifecycle (Synthetic L2: HTTP-stubbed, runnable without Docker or Azure)
- `Landing/` — buyer landing / Resolve + Activate
- `Persistence/` — EF Core state store
- `Subscriptions/` — domain model and state transitions
- `Webhook/` — webhook endpoint and token validation

The Synthetic L2 test (`SyntheticL2LifecycleTests`) covers the full
Resolve → Activate → webhook → state lifecycle over real local HTTP without Docker or Azure.
It is referenced in the README as the one-command proof.

**Recommendation (open):** Without running the full suite, the depth of negative-path coverage
(invalid state transitions, malformed webhook tokens, token replay, boundary input) cannot be
confirmed from directory structure alone. A follow-up pass on edge-case coverage is recommended.

### P2-2 Docs completeness

**What:** `docs/deploy*`, `docs/develop*`, `docs/l2-demo*`, walkthrough — accurate and runnable.

**Findings:**

- **`docs/deploy.md` / `docs/deploy.ja.md`:** Comprehensive step-by-step walkthrough of `az`
  commands. Uses `<placeholder>` syntax, explicitly warns against committing real IDs. Matches
  the `infra/` Bicep structure. ✅
- **`docs/develop.md` / `docs/develop.ja.md`:** Covers SQLite and SQL Server providers,
  migrations, running the app, appsettings, and the SQL Server integration tests. ✅
- **`docs/l2-demo.md` / `docs/l2-demo.ja.md`:** Covers both the Docker emulator path and the
  automated Synthetic L2. ✅
- **`docs/walkthrough.md` / `docs/walkthrough.ja.md`:** Excellent teaching material — metaphor
  map (shop / manufacturer / customer), full subscription lifecycle state diagram, call direction
  diagram, and a concrete code-mapping table. Japanese walkthrough uses pre-generated PNGs for
  all Mermaid diagrams. ✅

**Status: Complete.** Docs are structurally complete and accurate based on code and text review.

### P2-3 Guardrails visible in code

**What:** State DB is the single source of truth; explicit confirmation on state changes; no
token / secret / PII in model context or logs; webhook Authorization validated server-side.

**Findings:**

- **State DB as sole source of truth:** The domain aggregate in `SaaSAgentSample.Core` guards
  state transitions; invalid transitions are rejected. The app never fabricates state. ✅
- **Explicit confirmation:** Activation requires a form `POST` with anti-forgery token. State
  changes on the admin detail page require explicit confirmation. ✅
- **No secrets in logs:** `appsettings.json` uses placeholder IDs; no bearer token or secret
  logging was found in the service classes. ✅
- **Webhook validation is server-side:** `WebhookService` calls `IWebhookTokenValidator`
  (Entra JWT signature / issuer / audience / `appid` + Get Operation authorization) before
  updating any state. The `20e940b3-…` Marketplace app ID is the documented public constant,
  not a secret. ✅
- **No LLM context in v0:** The agent layer is not yet built; no risk of model-context leakage
  in this version. ✅

**Status: Correctly implemented.** All four guardrails are visible and enforced in code.

---

## Summary table

| # | Priority | Item | Status |
| --- | --- | --- | --- |
| P0-1 | **P0** | Repo name vs. contents: no agent in `src/`; README silent on it | ✅ **Fixed in this PR**; superseded 2026-09-02 by the rename to `marketplace-saas-fulfillment-sample` |
| P1-1 | P1 | Secrets / PII sweep | ✅ Clean |
| P1-2 | P1 | README ↔ UX drift | ✅ Accurate |
| P1-3 | P1 | Evaluate-without-deploy: no screenshots / GIF in README | ⚠️ **Open gap** — recommend screenshots |
| P1-4 | P1 | License / attribution | ✅ Complete |
| P1-A-1 | P1 | `aria-current` missing on stepper steps | ✅ **Fixed in this PR** |
| P1-A-2 | P1 | `aria-current` missing on nav and lang toggle links | ✅ **Fixed in this PR** |
| P1-A-3 | P2 | `.who.buyer` chip contrast (4.4:1, just below 4.5:1) | ⚠️ Open recommendation |
| P1-B | P1 | First-run clarity | ✅ Clear |
| P1-C | P1 | EN / JA parity | ✅ Complete |
| P2-1 | P2 | Test coverage of error / edge states | ⚠️ Not confirmed — recommend pass |
| P2-2 | P2 | Docs completeness | ✅ Complete |
| P2-3 | P2 | Guardrails visible in code | ✅ Correctly implemented |

**Overall verdict:** The fulfillment-plane implementation is clean, honest, and well-structured for
a teaching sample. The P0 name-vs-contents gap and the three `aria-current` accessibility gaps are
fixed in this PR. The most meaningful remaining risk for a partner first impression is the absence
of screenshots — a partner cannot judge the UX without running the app.
