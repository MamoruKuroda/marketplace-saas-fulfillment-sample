(function () {
    "use strict";
    const model = window.WebCheckoutModel;
    const journey = window.PurchaseJourney;
    const $ = id => document.getElementById(id);
    const ja = {
        training: "架空データを使う教材", notice: "教材専用。実注文・請求・Lead送信は発生しません。実アカウント、住所、税ID、カード情報を入力しないでください。",
        settings: "プレゼンター設定", preset: "教材プリセット", general: "架空の購入シミュレーション", observation: "PTC実観察の参照（読み取り専用）",
        route: "購入経路", commercial: "商業条件", public: "公開掲載条件の例", private: "Private Offer の説明", activation: "有効化方式（プラン設定）", auto: "自動", manual: "手動",
        countryStep: "国のステップ", show: "表示", hide: "省略", planCount: "プラン数", one: "単一", multiple: "複数", paymentFrequency: "支払頻度（架空例）", annual: "年払い", upfront: "一括払い", renewDefault: "更新の初期値",
        fixtureNote: "国の表示条件は未確認です。PTC参照は公開0円・Web・自動有効化・単一プランの観察であり、Private Offer の受諾ではありません。設定変更は画面内の模擬注文をリセットします。",
        reset: "最初からやり直す", countryTitle: "請求国", countryNote: "国と言語は別です。これは架空の選択で、国の登録・変更は行いません。", countryLabel: "請求国（必須）",
        choose: "選択してください", japan: "日本", usa: "米国", planTitle: "プランを選択", product: "架空の Workspace Automation SaaS", planLegend: "プラン",
        commercialNote: "公開条件とPrivate Offerは独立した設定です。商談条件・署名済み注文契約・Private Offerの承認／購入は別々です。この教材は専用のPrivate Offer購入画面を再現しません。",
        priceTitle: "価格と請求", term: "契約期間", paymentOption: "価格・支払頻度:", activationNote: "自動／手動はプランの設定で、購入時の自動更新とは別です。",
        renew: "自動更新", cardInvoice: "Webでの支払い", invoiceNote: "カードまたは請求書払いの例。請求書払いは条件を満たし承認された組織が対象です。",
        invoiceLink: "請求書払いの公式資料（別タブ）", azureRoute: "Azure subscription を使う別経路", macc: "Marketplace Web でカードを使って直接購入した SaaS は MACC 対象外です。MACC への算入には、Azure portal で対象の MACC 契約に紐づく Azure subscription を指定し、適格なオファーを購入するなどの条件を満たす必要があります。算入可否は、最終的なカード払いの可否（契約等の条件によります）や、Azure 料金と同じ請求書に載るかどうかでは判断しません。",
        maccLink: "MACC の公式資料（別タブ）", azureExample: "既存の Azure portal 型教材を開く", paymentTitle: "支払い", observedPriceNote: "観察された表示差：前画面の1年は ¥0/year、Payment は ¥0.00/one-time payment と ¥0.00 for 1 year。理由は未確認です。",
        soldTo: "Sold-to / Billing account", fictionalAccount: "架空の請求先組織（住所や税IDの入力はありません）", billTo: "Bill-to / Billing profile",
        profile: "請求プロファイル（必須）", chooseProfile: "請求プロファイル未選択", sampleProfile: "サンプル請求プロファイル", sampleTeamProfile: "サンプルチームの請求プロファイル",
        addProfile: "＋ 新規追加", profileSafety: "架空の選択肢のみ。保存はこの画面内の一時データで、外部へ送信されません。",
        profileName: "請求プロファイル名（必須）", po: "発注番号（任意）", noPo: "なし", method: "支払方法（必須）", demoCard: "サンプルカード（番号なし）",
        demoInvoice: "サンプル請求書払い", profileRequired: "請求プロファイル名と支払方法を選択してください。", save: "保存（画面内のみ）", cancel: "取消",
        tax: "推定税:", taxNote: "教材のため ¥0（実際の税額ではありません）", total: "合計:", legal: "法務事項", legalNote: "これは契約への同意ではありません。以下は説明資料です。",
        legalLink: "Marketplace 利用条件（別タブ）", profilesLink: "請求プロファイルの公式資料（別タブ）", mockOrder: "模擬注文（実注文・請求なし）",
        simulationTitle: "購入後の教材シミュレーション", simulationBoundary: "公式仕様に基づくシミュレーション。実注文、実API、実Webhook、製品の作成は行っていません。",
        marketplaceState: "購入直後の購読状態（模擬）", productReadiness: "製品の準備状態", notConfirmed: "未確認（購読状態だけでは利用可能と判断できません）",
        presenterDetails: "プレゼンター向け詳細", readinessControl: "製品準備の模擬状態（購読とは別）", readinessUnknown: "未確認", readinessPreparing: "準備中（模擬）", readinessReady: "利用開始可能（模擬）",
        autoOverview: "Marketplaceの購読は自動有効化される例です。製品の利用準備は別に確認します。", manualOverview: "手動有効化では購入直後は PendingFulfillmentStart です。設定開始後に提供者が有効化します。",
        roles: "購入担当は条件と請求を確認し、利用担当に引き継ぎます。製品提供者は別途、製品アカウントや環境を準備します。",
        privateBoundary: "この教材は Private Offer の受諾や実際の契約締結を再現しません。価格やMACC適格性を保証するものではありません。",
        configureTitle: "購入者がアカウント設定を開始", configureNow: "Configure account now（模擬）",
        configureExplanation: "実際の手動有効化では、購入後の画面または確認メールの Configure now から提供者の Landing Page を開きます。この操作自体は有効化ではありません。",
        handoffBoundary: "このボタンは、同じ架空注文のID・プラン・期間・更新設定を模擬トークンで既存教材へ渡します。価格や請求情報は渡しません。エミュレーターの購読レコードは移動先の Resolve 時に初めて作られます。実メールは送信しません。購入直後の表示はライブ更新されず、再読み込みでこの画面の模擬注文は消えます。",
        mockOrderId: "模擬注文ID:",
        catalogueBoundary: "Web教材専用の架空オファーとプランはエミュレーターのカタログに未登録です。Resolve／Activate は試せますが、プラン変更の演習には対応するオファーの登録が必要です。",
        lifecycleDoc: "公式資料: SaaS 購読ライフサイクル（別タブ）",
        configLoading: "既存教材の設定先を確認しています…", configError: "設定先を読み込めません。静的プレビューではなくエミュレーターを起動し、Landing Page の設定を確認してください。",
        retryConfig: "設定先を再確認", purchaseError: "模擬注文を作成できません。ブラウザーの設定を確認して再試行してください。",
        back: "戻る", next: "次へ", legacy: "既存の購入教材に戻る",
        observed: "実観察の参照：公開0円画面の注文前まで。操作は教材内の再現です。", mock: "架空のローカル教材：価格・組織・請求先は実在しません。",
        routeCaution: "Azure portal型の画面自体は今回未観察です。ここはWeb形式の説明画面で、Azure portal型は別の既存教材から操作します。",
        planDescription: "架空サービスのプラン。年額のサンプルを期間に応じて合計します。", observedDescription: "公開画面の表示を参照した例。製品や取引条件を保証しません。",
        years: "年", yearPrice: "年額", perYear: "/year", oneTime: "/one-time payment", forYears: " for {n} year(s)",
        errCountry: "請求国を選択してください。", errPlan: "プランを選択してください。", errProfile: "請求プロファイルを選択してください。",
        completeStep: "購入完了", stopped: "実観察は注文前で終了。模擬注文には一般プリセットを選択してください。",
        autoDetail: "自動有効化では PendingFulfillmentStart を経由せず Subscribed となる仕様です。購入者による Resolve／Activate は必須ではなく、提供者は Subscribe webhook を扱います。これは実Webhookではありません。",
        manualDetail: "手動では購入者が設定を開始した後、提供者は渡されたトークンを Resolve し、明示確認・Activate を経て購読が有効になり課金が始まります。実際の購読は30日以内に有効化されないと取り消されます。",
        offer: "オファー", plan: "プラン", billing: "契約期間", renewal: "自動更新", on: "On", off: "Off", price: "価格", subtotal: "期間小計"
    };
    const en = {
        training: "Training with fictional data", notice: "Training only. No real order, charge, or lead is sent. Do not enter real accounts, addresses, tax IDs, or card information.",
        settings: "Presenter settings", preset: "Training preset", general: "Fictional purchase simulation", observation: "PTC observation reference (read-only)",
        route: "Purchase route", commercial: "Commercial terms", public: "Public listing example", private: "Private Offer explanation", activation: "Activation (plan setting)", auto: "Automatic", manual: "Manual",
        countryStep: "Country step", show: "Show", hide: "Omit", planCount: "Plans", one: "Single", multiple: "Multiple", paymentFrequency: "Payment frequency (fictional)", annual: "Annual", upfront: "Upfront", renewDefault: "Renewal initial value",
        fixtureNote: "The country-step condition is unconfirmed. PTC reference is a public zero-price, Web, automatic-activation, single-plan observation, not Private Offer acceptance. Changing settings resets the in-page simulation.",
        reset: "Start over", countryTitle: "Billing country", countryNote: "Country and language are separate. This fictional selection does not register or change a country.", countryLabel: "Billing country (required)",
        choose: "Select", japan: "Japan", usa: "United States", planTitle: "Select a plan", product: "Fictional Workspace Automation SaaS", planLegend: "Plan",
        commercialNote: "Public terms and Private Offers are independent. Commercial negotiation, a signed order agreement, and Private Offer approval/purchase are distinct. This training does not recreate a private-offer purchase UI.",
        priceTitle: "Price + billing", term: "Billing term", paymentOption: "Price / payment frequency:", activationNote: "Auto/manual is a plan setting, separate from the buyer's auto-renew choice.",
        renew: "Auto-renew", cardInvoice: "Web payment", invoiceNote: "Card or invoice examples. Invoice payment is available only to eligible, approved organizations.",
        invoiceLink: "Official invoice guidance (new tab)", azureRoute: "Alternative: Azure subscription", macc: "SaaS purchased directly by card on Marketplace Web does not count toward MACC. To count toward MACC, purchases must meet requirements such as purchasing an eligible offer through Azure portal using an Azure subscription linked to the applicable MACC agreement. Eligibility is not determined by whether the resulting charges can be paid by card (which depends on the agreement and other conditions) or whether they appear on the same invoice as Azure charges.",
        maccLink: "Official MACC guidance (new tab)", azureExample: "Open existing Azure portal training", paymentTitle: "Payment", observedPriceNote: "Observed label difference: one year was ¥0/year on the previous screen, but ¥0.00/one-time payment and ¥0.00 for 1 year on Payment. The reason is unconfirmed.",
        soldTo: "Sold-to / Billing account", fictionalAccount: "Fictional billing organization (no address or tax ID input)", billTo: "Bill-to / Billing profile",
        profile: "Billing profile (required)", chooseProfile: "No billing profile selected", sampleProfile: "Sample billing profile", sampleTeamProfile: "Sample team billing profile",
        addProfile: "+ Add new", profileSafety: "Fictional choices only. Save is temporary within this page and sends nothing externally.",
        profileName: "Billing profile name (required)", po: "Purchase order number (optional)", noPo: "None", method: "Payment method (required)", demoCard: "Sample card (no number)",
        demoInvoice: "Sample invoice payment", profileRequired: "Select a billing profile name and payment method.", save: "Save (page only)", cancel: "Cancel",
        tax: "Estimated tax:", taxNote: "¥0 for training (not an actual tax calculation)", total: "Total:", legal: "Legal terms", legalNote: "This is not agreement to a contract. The following are documentation links.",
        legalLink: "Marketplace terms (new tab)", profilesLink: "Official billing profile guidance (new tab)", mockOrder: "Simulate order (no real purchase or charge)",
        simulationTitle: "Post-purchase training simulation", simulationBoundary: "Simulation based on official documentation. No real order, API, webhook, or product provisioning was performed.",
        marketplaceState: "Subscription state immediately after purchase (simulated)", productReadiness: "Product readiness", notConfirmed: "Unconfirmed (subscription status alone does not establish product readiness)",
        presenterDetails: "Presenter details", readinessControl: "Simulated product readiness (separate from subscription)", readinessUnknown: "Unconfirmed", readinessPreparing: "Preparing (simulated)", readinessReady: "Ready to use (simulated)",
        autoOverview: "This example activates the Marketplace subscription automatically. Product readiness must be checked separately.", manualOverview: "With manual activation, the state immediately after purchase is PendingFulfillmentStart. The publisher activates it after setup begins.",
        roles: "The buyer checks terms and billing and hands off to the user. The publisher separately prepares the product account and environment.",
        privateBoundary: "This training does not recreate Private Offer acceptance or a real agreement. Prices and MACC eligibility are not guaranteed.",
        configureTitle: "Buyer starts account setup", configureNow: "Configure account now (simulation)",
        configureExplanation: "For manual activation, the buyer opens the publisher's landing page from the post-purchase screen or the Configure now link in the confirmation email. This action does not itself activate the subscription.",
        handoffBoundary: "This button passes the same fictional order ID, plan, term and renewal setting to the existing training in a simulated token, but not pricing or billing information. The emulator first creates its subscription record when the destination resolves it. No email is sent. This purchase-time display is not live and the in-page order is lost on reload.",
        mockOrderId: "Simulated order ID:",
        catalogueBoundary: "The fictional Web-training offer and plans are not registered in the emulator catalogue. Resolve and Activate work, but plan-change exercises require a corresponding offer to be registered.",
        lifecycleDoc: "Official SaaS subscription lifecycle (new tab)",
        configLoading: "Checking the existing training's destination…", configError: "Could not load the destination. Start the emulator rather than a static preview and check its landing-page configuration.",
        retryConfig: "Retry destination", purchaseError: "Could not create the simulated order. Check your browser settings and retry.",
        back: "Back", next: "Next", legacy: "Return to existing purchase training",
        observed: "Observed reference: public zero-price screen before ordering only. Interactions here are a training recreation.", mock: "Fictional local training: prices, organizations and billing data are not real.",
        routeCaution: "The Azure portal purchase screen was not observed in this investigation. This is a Web-format explanation; use the separate existing training for the portal example.",
        planDescription: "A fictional service plan. Sample annual pricing is totaled over the term.", observedDescription: "Based on the public display; this does not guarantee any product or transaction terms.",
        years: " year(s)", yearPrice: "Annual", perYear: "/year", oneTime: "/one-time payment", forYears: " for {n} year(s)",
        errCountry: "Select a billing country.", errPlan: "Select a plan.", errProfile: "Select a billing profile.",
        completeStep: "Complete purchase", stopped: "Observation stopped before order. Select the general preset to simulate an order.",
        autoDetail: "Automatic activation goes directly to Subscribed without PendingFulfillmentStart. Customer Resolve/Activate is not required; the publisher handles a Subscribe webhook. No webhook is sent here.",
        manualDetail: "After the buyer starts setup, the publisher resolves the supplied token and activates the purchase after explicit confirmation, starting billing. A real subscription is canceled if not activated within 30 days.",
        offer: "Offer", plan: "Plan", billing: "Billing term", renewal: "Auto-renew", on: "On", off: "Off", price: "Price", subtotal: "Term subtotal"
    };
    const requestedLanguage = new URLSearchParams(location.search).get("culture");
    const storedLanguage = localStorage.getItem("emu-lang");
    let lang = ["ja", "en"].includes(requestedLanguage) ? requestedLanguage :
        (["ja", "en"].includes(storedLanguage) ? storedLanguage : ((navigator.language || "").toLowerCase().startsWith("ja") ? "ja" : "en"));
    let state = model.initial();
    let step = "plan";
    let manualOrder = null;
    let landingTarget = null;
    let configStatus = "idle";
    let configVersion = 0;
    const text = key => (lang === "ja" ? ja : en)[key];
    const money = value => "¥" + value.toLocaleString("en-US");
    const steps = () => (state.countryStep ? ["country", "plan", "price", "payment", "complete"] : ["plan", "price", "payment", "complete"]);
    const names = { country: "countryTitle", plan: "planTitle", price: "priceTitle", payment: "paymentTitle", complete: "completeStep" };
    function label(node, value) { node.textContent = value; }
    function optionRadio(name, value, title, checked, onChange) {
        const wrapper = document.createElement("label");
        wrapper.className = "wc-option";
        const input = document.createElement("input");
        input.type = "radio"; input.name = name; input.value = String(value); input.checked = checked;
        input.addEventListener("change", onChange);
        wrapper.append(input, document.createTextNode(title));
        return wrapper;
    }
    function pair(container, name, value) {
        const dt = document.createElement("dt"); dt.textContent = name;
        const dd = document.createElement("dd"); dd.textContent = value;
        container.append(dt, dd);
    }
    function clearError() { $("error").hidden = true; $("error").textContent = ""; }
    function error(key, control) {
        $("error").textContent = text(key); $("error").hidden = false;
        control.setAttribute("aria-invalid", "true"); control.focus();
    }
    function draw(focus) {
        document.documentElement.lang = lang;
        document.querySelectorAll("[data-text]").forEach(node => label(node, text(node.dataset.text)));
        $("lang-ja").setAttribute("aria-pressed", String(lang === "ja"));
        $("lang-en").setAttribute("aria-pressed", String(lang === "en"));
        $("preset").value = state.preset; $("route").value = state.route;
        $("commercial").value = state.commercial; $("activation").value = state.activation;
        $("country-step").value = state.countryStep ? "yes" : "no";
        $("plan-count").value = state.planCount; $("renew-default").value = state.renewDefault ? "on" : "off";
        $("payment-frequency").value = state.paymentFrequency;
        ["route", "commercial", "activation", "plan-count", "payment-frequency"].forEach(id => { $(id).disabled = state.preset === "observation"; });
        $("country-select").value = state.country;
        $("renew").checked = state.renew;
        $("profile").value = state.profile;
        const progress = $("progress"); progress.replaceChildren();
        steps().forEach(name => {
            const li = document.createElement("li"); li.textContent = text(names[name]);
            if (name === step) li.setAttribute("aria-current", "step");
            progress.appendChild(li);
        });
        ["country", "plan", "price", "payment", "complete"].forEach(name => { $(name).hidden = step !== name; });
        $("evidence-class").textContent = text(state.preset === "observation" ? "observed" : "mock") + (state.route === "azure" ? " " + text("routeCaution") : "");
        const plans = $("plans"); plans.replaceChildren();
        model.plans(state).forEach(item => {
            plans.appendChild(optionRadio("plan-choice", item.id, item[lang], state.plan === item.id, () => {
                state.plan = item.id; draw(false); plans.querySelector("input:checked").focus();
            }));
        });
        $("plan-details").textContent = text(state.preset === "observation" ? "observedDescription" : "planDescription") + " " +
            (state.preset === "observation" ? "1: ¥0/year; 2–5: ¥0/one-time payment." : text("yearPrice") + ": " + money(model.fixtures.general.plans.find(item => item.id === state.plan).price));
        const prices = $("plan-prices"); prices.replaceChildren();
        model.fixtures[state.preset].terms.forEach(term => {
            const item = document.createElement("li");
            const termQuote = model.quote(Object.assign({}, state, { term: term }));
            item.textContent = term + text("years") + ": " + money(termQuote.amount) +
                text(termQuote.frequency === "oneTime" ? "oneTime" : "perYear");
            prices.appendChild(item);
        });
        const terms = $("terms"); terms.replaceChildren();
        model.fixtures[state.preset].terms.forEach(term => {
            terms.appendChild(optionRadio("term-choice", term, term + text("years"), state.term === term, () => {
                state.term = term; draw(false); terms.querySelector("input:checked").focus();
            }));
        });
        const quote = model.quote(state);
        $("price-display").textContent = money(quote.amount) + text(quote.frequency === "oneTime" ? "oneTime" : "perYear");
        $("activation-display").textContent = text(state.activation) + " (" + (state.activation === "auto" ? "On" : "Off") + ")";
        const summary = $("summary"); summary.replaceChildren();
        const chosen = model.plans(state).find(item => item.id === state.plan);
        pair(summary, text("offer"), state.preset === "observation" ? "PTC public listing (reference)" : "Workspace Automation");
        pair(summary, text("route"), state.route === "azure" ? "Azure portal" : "Marketplace Web");
        pair(summary, text("commercial"), text(state.commercial));
        pair(summary, text("plan"), chosen[lang]); pair(summary, text("billing"), state.term + text("years"));
        pair(summary, text("renewal"), text(state.renew ? "on" : "off")); pair(summary, text("activation"), text(state.activation));
        const observedPrice = state.preset === "observation" && state.term === 1;
        pair(summary, text("price"), observedPrice ? "¥0.00/one-time payment" : $("price-display").textContent);
        pair(summary, text("subtotal"), observedPrice ? "¥0.00 for 1 year" : money(quote.total) + text("forYears").replace("{n}", state.term));
        $("observed-price-note").hidden = !observedPrice;
        $("total").textContent = money(quote.total);
        $("order").disabled = !state.profile || state.confirmed || state.preset === "observation";
        $("order").title = state.preset === "observation" ? text("stopped") : "";
        $("subscription-state").textContent = state.subscriptionState;
        const readinessKey = { unconfirmed: "notConfirmed", preparing: "readinessPreparing", ready: "readinessReady" }[state.productReadiness];
        document.querySelector("#complete dd[data-text=notConfirmed]").textContent = text(readinessKey);
        $("readiness").value = state.productReadiness;
        $("completion-overview").textContent = text(state.activation === "auto" ? "autoOverview" : "manualOverview");
        $("completion-detail").textContent = text(state.activation === "auto" ? "autoDetail" : "manualDetail");
        const manual = state.confirmed && state.activation === "manual";
        $("manual-handoff").hidden = !manual;
        $("mock-order-id").textContent = manualOrder ? manualOrder.id : "";
        const configure = $("configure-account");
        configure.hidden = !manual || configStatus !== "ready";
        if (!configure.hidden) {
            const token = journey.purchaseToken(manualOrder, {
                autoRenew: manualOrder.autoRenew, isTest: manualOrder.isTest, term: manualOrder.term
            }).base64;
            const url = new URL(journey.landingUrl(landingTarget, token));
            url.searchParams.set("culture", lang);
            url.searchParams.set("scenario", state.route === "azure" ? "azure-portal" : "web-card");
            configure.href = url.href;
        } else {
            configure.removeAttribute("href");
        }
        $("handoff-status").textContent = configStatus === "loading" ? text("configLoading")
            : configStatus === "error" ? text("configError") : "";
        $("retry-config").hidden = configStatus !== "error";
        $("azure-example").href = "/start.html?scenario=azure-portal&culture=" + lang;
        $("back").hidden = step === steps()[0] || step === "complete";
        $("next").hidden = step === "payment" || step === "complete";
        if (focus) $(step).querySelector("h2").focus();
    }
    function resetDraft() {
        configVersion++;
        manualOrder = null; landingTarget = null; configStatus = "idle";
        state.country = state.countryStep ? "" : "JP";
        state.plan = model.plans(state)[0].id; state.term = 1; state.renew = state.renewDefault;
        state.profile = ""; state.profileName = ""; state.profileMethod = "";
        state.confirmed = false; state.subscriptionState = "notOrdered"; state.productReadiness = "unconfirmed";
        step = state.countryStep ? "country" : "plan";
        $("profile-form").hidden = true; $("profile-name").value = ""; $("profile-method").value = ""; $("po").value = "none";
        $("profile-error").hidden = true; $("country-select").removeAttribute("aria-invalid");
        $("profile").removeAttribute("aria-invalid"); clearError(); draw(true);
    }
    async function prepareHandoff() {
        const order = manualOrder;
        const version = ++configVersion;
        configStatus = "loading";
        draw(false);
        try {
            const response = await fetch("/api/util/config");
            if (!response.ok) throw new Error("config");
            const config = await response.json();
            const url = new URL(config.landingPageUrl);
            const localHosts = ["localhost", "127.0.0.1", "[::1]"];
            if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
                (localHosts.includes(url.hostname) && !localHosts.includes(location.hostname))) throw new Error("config");
            if (version !== configVersion || order !== manualOrder) return;
            landingTarget = url.href;
            configStatus = "ready";
        } catch (error) {
            if (version !== configVersion || order !== manualOrder) return;
            landingTarget = null;
            configStatus = "error";
        }
        draw(false);
    }
    function setting(id, key, convert) {
        $(id).addEventListener("change", () => { state[key] = convert ? convert($(id).value) : $(id).value; resetDraft(); });
    }
    $("preset").addEventListener("change", () => {
        model.selectPreset(state, $("preset").value);
        resetDraft();
    });
    setting("route", "route"); setting("commercial", "commercial");
    setting("activation", "activation"); setting("country-step", "countryStep", value => value === "yes");
    setting("plan-count", "planCount"); setting("payment-frequency", "paymentFrequency"); setting("renew-default", "renewDefault", value => value === "on");
    $("reset").addEventListener("click", resetDraft);
    $("retry-config").addEventListener("click", prepareHandoff);
    $("lang-ja").addEventListener("click", () => { lang = "ja"; localStorage.setItem("emu-lang", lang); draw(false); });
    $("lang-en").addEventListener("click", () => { lang = "en"; localStorage.setItem("emu-lang", lang); draw(false); });
    $("country-select").addEventListener("change", () => { state.country = $("country-select").value; $("country-select").removeAttribute("aria-invalid"); clearError(); });
    $("renew").addEventListener("change", () => { state.renew = $("renew").checked; });
    $("readiness").addEventListener("change", () => { state.productReadiness = $("readiness").value; draw(false); });
    $("profile").addEventListener("change", () => { state.profile = $("profile").value; $("profile").removeAttribute("aria-invalid"); clearError(); draw(false); });
    $("next").addEventListener("click", () => {
        clearError();
        if (step === "country" && !state.country) return error("errCountry", $("country-select"));
        if (step === "plan" && !model.plans(state).some(item => item.id === state.plan)) return error("errPlan", $("plans"));
        step = steps()[steps().indexOf(step) + 1]; draw(true);
    });
    $("back").addEventListener("click", () => { clearError(); step = steps()[steps().indexOf(step) - 1]; draw(true); });
    $("add-profile").addEventListener("click", () => { $("profile-form").hidden = false; $("profile-name").focus(); });
    $("cancel-profile").addEventListener("click", () => {
        $("profile-form").hidden = true; $("profile-name").value = ""; $("po").value = "none"; $("profile-method").value = "";
        $("profile-error").hidden = true; $("add-profile").focus();
    });
    $("save-profile").addEventListener("click", () => {
        if (!$("profile-name").value || !$("profile-method").value) {
            $("profile-error").hidden = false;
            (!$("profile-name").value ? $("profile-name") : $("profile-method")).focus();
            return;
        }
        state.profileName = $("profile-name").value; state.profileMethod = $("profile-method").value;
        state.profile = state.profileName === "demo-team" ? "sample-team" : "sample";
        $("profile-form").hidden = true; $("profile-error").hidden = true; draw(false); $("profile").focus();
    });
    $("order").addEventListener("click", () => {
        if (!state.profile) return error("errProfile", $("profile"));
        if (!model.complete(state)) return;
        if (state.activation === "manual") {
            try {
                manualOrder = model.manualPurchase(state, journey.newId());
            } catch (cause) {
                state.confirmed = false;
                state.subscriptionState = "notOrdered";
                return error("purchaseError", $("order"));
            }
        }
        step = "complete"; draw(true);
        if (manualOrder) prepareHandoff();
    });
    draw(false);
}());
