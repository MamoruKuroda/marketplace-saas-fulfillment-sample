const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { TextEncoder } = require("node:util");

const client = path.join(__dirname, "..", "client");
const source = name => fs.readFileSync(path.join(client, name), "utf8");
const cases = [];
const check = (name, run) => cases.push([name, run]);
const catalogue = {
    "existing/offer & one": {
        offerId: "existing/offer & one",
        displayName: "Existing service",
        publisher: "Demo publisher",
        plans: {
            basic: {
                displayName: "Basic", isPricePerSeat: false,
                planComponents: { recurrentBillingTerms: [{ price: 37, currency: "GBP", termUnit: "P1M" }] }
            },
            "team & annual": {
                displayName: "Team annual", isPricePerSeat: true,
                planComponents: { recurrentBillingTerms: [{ price: 415, currency: "GBP", termUnit: "P1Y" }] }
            }
        }
    }
};

class Element {
    constructor(tag = "div") {
        this.tag = tag;
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.hidden = false;
        this.disabled = false;
        this.checked = false;
        this.selectedIndex = 0;
        this.textContent = "";
        this.className = "";
        this.rawValue = "";
        this.dataset = {};
        this.classList = {
            toggle: (name, enabled) => {
                const names = new Set(this.className.split(" ").filter(Boolean));
                if (enabled) names.add(name);
                else names.delete(name);
                this.className = Array.from(names).join(" ");
            }
        };
    }
    get options() { return this.children; }
    get value() {
        return this.tag === "select" ? (this.children[this.selectedIndex]?.value || "") : this.rawValue;
    }
    set value(value) {
        if (this.tag === "select") this.selectedIndex = this.children.findIndex(item => item.value === value);
        else this.rawValue = value;
    }
    appendChild(node) { this.children.push(node); node.parentNode = this; return node; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    replaceChildren() { this.children = []; this.selectedIndex = 0; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
    addEventListener(name, run) { this.listeners[name] = run; }
    querySelectorAll() { return []; }
    closest() { return null; }
    focus() { this.focused = true; }
}

function runtime(query = "", language = "en") {
    const ready = [];
    const nodes = new Map();
    const requests = [];
    const store = new Map();
    const document = {
        readyState: "loading",
        addEventListener: (_name, run) => ready.push(run),
        querySelectorAll: () => [],
        querySelector: () => null,
        createElement: tag => new Element(tag),
        getElementById: id => nodes.get(id),
        body: new Element("body")
    };
    const sandbox = {
        URL, URLSearchParams, TextEncoder, document,
        location: new URL("https://emulator.example/start.html" + query),
        localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) },
        navigator: { language },
        i18nLang: () => language,
        t: key => key,
        setTimeout: () => {},
        btoa: text => Buffer.from(text, "binary").toString("base64"),
        fetch: async url => {
            requests.push(url);
            return { ok: true, json: async () => catalogue };
        }
    };
    sandbox.history = {
        replaceState: (_state, _title, target) => { sandbox.location.href = new URL(target, sandbox.location).href; }
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    const load = name => vm.runInContext(source(name), context, { filename: name });
    load("purchase-journey.js");
    return { sandbox, context, load, ready, nodes, requests };
}

function discovery(query = "") {
    const test = runtime(query);
    [
        "discovery-form", "discovery-offer", "discovery-plan", "discovery-continue",
        "catalogue-error", "catalogue-status", "catalogue-error-message", "listing-surface",
        "scenario-warning", "product-preview", "product-name", "product-publisher",
        "product-price", "product-period", "plan-cards"
    ].forEach(id => test.nodes.set(id, new Element(id.endsWith("-offer") || id.endsWith("-plan") ? "select" : "div")));
    ["discovery-offer", "discovery-plan", "discovery-continue"].forEach(id => { test.nodes.get(id).disabled = true; });
    ["catalogue-error", "scenario-warning", "product-preview"].forEach(id => { test.nodes.get(id).hidden = true; });
    const radios = ["web-card", "web-azure", "azure-portal"].map(value => {
        const radio = new Element("input");
        radio.value = value;
        return radio;
    });
    const form = test.nodes.get("discovery-form");
    form.querySelectorAll = () => radios;
    form.querySelector = selector => selector.endsWith(":checked")
        ? radios.find(radio => radio.checked)
        : radios.find(radio => selector.includes('value="' + radio.value + '"'));
    test.sandbox.document.querySelector = selector => selector.includes('name="scenario"')
        ? form.querySelector(selector) : null;
    test.sandbox.document.querySelectorAll = selector => {
        if (selector === 'input[name="scenario"]') return radios;
        if (selector === ".plan-card") return test.nodes.get("plan-cards").children;
        return [];
    };
    const createElement = test.sandbox.document.createElement;
    test.sandbox.document.createElement = tag => {
        const node = createElement(tag);
        node.querySelector = selector => node.children.find(child => child.tag === selector);
        return node;
    };
    test.load("purchase-experience.js");
    test.load("start.js");
    return { ...test, radios, start: () => test.ready[test.ready.length - 1]() };
}

function checkout(query = "") {
    const test = runtime(query);
    const state = new Map();
    const rendered = [];
    let start;
    function wrap(items) {
        const first = items[0];
        const api = {
            val(value) {
                if (arguments.length === 0) return first.value ?? first.options?.[0]?.value ?? "";
                items.forEach(item => { item.value = value; });
                return api;
            },
            text(value) { items.forEach(item => { item.text = value; }); return api; },
            data(key, value) {
                if (arguments.length === 1) return first.data[key];
                items.forEach(item => { item.data[key] = value; });
                return api;
            },
            prop(key, value) {
                if (arguments.length === 1) return first[key];
                items.forEach(item => { item[key] = value; });
                return api;
            },
            attr(key, value) { return api.prop(key, value); },
            css(values) { items.forEach(item => Object.assign(item, values)); return api; },
            on(name, run) { items.forEach(item => { item.events[name] = run; }); return api; },
            trigger(name) { items.forEach(item => item.events[name]?.()); return api; },
            is() { return !!first.checked; },
            empty() { first.options = []; first.value = undefined; return api; },
            append(option) { first.options.push(option.item); return api; },
            addClass() { return api; },
            removeClass() { return api; },
            toggleClass() { return api; },
            parent() { return api; },
            hide() { items.forEach(item => { item.hidden = true; }); return api; },
            item: first
        };
        return api;
    }
    test.sandbox.$ = selector => {
        if (typeof selector === "function") { start = selector; return; }
        if (selector === "<option></option>") return wrap([{}]);
        return wrap(selector.split(",").map(key => {
            if (!state.has(key)) state.set(key, { data: {}, events: {} });
            return state.get(key);
        }));
    };
    test.sandbox.callAPI = async url => {
        test.requests.push(url);
        return { status: 200, result: { landingPageUrl: "https://publisher.example" } };
    };
    test.sandbox.guid = () => "unchanged-demo-guid";
    test.sandbox.renderOffer = (_container, offer, _actionText, action) => rendered.push({ offer, action });
    test.load("index.js");
    return { ...test, state, rendered, start: () => start() };
}

for (const scenario of ["web-card", "web-azure", "azure-portal"]) {
    check(`${scenario}: context, catalogue selection and checkout navigation`, async () => {
        const requested = new URLSearchParams({ scenario, culture: "ja", offer: "existing/offer & one", plan: "team & annual" });
        const test = discovery("?" + requested);
        test.sandbox.i18nLang = () => "ja";
        await test.start();
        assert.equal(test.nodes.get("discovery-offer").value, "existing/offer & one");
        assert.equal(test.nodes.get("discovery-plan").value, "team & annual");
        assert.equal(test.nodes.get("discovery-continue").disabled, false);
        assert.equal(test.nodes.get("discovery-continue").textContent,
            scenario === "azure-portal" ? "journey.subscribe" : "common.getItNow");
        assert.equal(test.nodes.get("listing-surface").textContent, `journey.${scenario}.surface`);
        test.nodes.get("discovery-form").listeners.submit({ preventDefault() {} });
        const target = test.sandbox.location;
        assert.equal(target.pathname, "/checkout.html");
        assert.equal(target.searchParams.get("scenario"), scenario);
        assert.equal(target.searchParams.get("culture"), "ja");
        assert.equal(target.searchParams.get("offer"), "existing/offer & one");
        assert.equal(target.searchParams.get("plan"), "team & annual");
        assert.deepEqual(test.requests, ["/api/util/offers"]);
    });
}

check("unknown scenario is ignored by metadata helpers and visibly defaults on discovery", async () => {
    const test = discovery("?scenario=__proto__");
    assert.equal(test.sandbox.PurchaseJourney.context().scenario, null);
    assert.equal(test.sandbox.PurchaseJourney.withContext("/?scenario=web-card").searchParams.has("scenario"), false);
    await test.start();
    assert.equal(test.nodes.get("scenario-warning").hidden, false);
    assert.equal(test.radios.find(item => item.checked).value, "web-card");
    assert.equal(test.sandbox.location.searchParams.get("scenario"), "web-card");
    for (const value of [null, "", "Web-Card", "constructor", "web-card<script>", "web-card,web-azure"]) {
        assert.equal(test.sandbox.PurchaseJourney.scenario(value), null);
    }
});

check("scenario switching changes presentation, not catalogue or selected plan", async () => {
    const test = discovery("?scenario=web-card");
    await test.start();
    const offer = test.nodes.get("discovery-offer").value;
    const plan = test.nodes.get("discovery-plan").value;
    test.radios.forEach(radio => { radio.checked = radio.value === "azure-portal"; });
    test.radios[2].listeners.change();
    assert.equal(test.sandbox.location.searchParams.get("scenario"), "azure-portal");
    assert.equal(test.nodes.get("discovery-offer").value, offer);
    assert.equal(test.nodes.get("discovery-plan").value, plan);
    assert.deepEqual(test.requests, ["/api/util/offers"]);
});

check("product-first entry shows catalogue prices and selecting a plan card updates the buy panel", async () => {
    const test = discovery();
    await test.start();
    assert.equal(test.nodes.get("product-preview").hidden, false);
    assert.equal(test.nodes.get("product-price").textContent, "£37.00");
    assert.equal(test.nodes.get("product-period").textContent, "experience.monthly");
    const cards = test.nodes.get("plan-cards").children;
    assert.equal(cards.length, 2);
    assert.equal(cards[0].children[1].textContent, "£37.00 · experience.monthly");
    cards[1].querySelector("button").listeners.click();
    assert.equal(test.nodes.get("discovery-plan").value, "team & annual");
    assert.equal(test.nodes.get("product-price").textContent, "£415.00");
    assert.equal(test.nodes.get("product-period").textContent, "experience.annual · experience.perUser");
    assert.equal(cards[1].querySelector("button").getAttribute("aria-pressed"), "true");
    assert.equal(cards[0].querySelector("button").getAttribute("aria-pressed"), "false");
    assert.equal(test.nodes.get("discovery-plan").focused, true);
});

check("built-in product and plan cards show fixed sample prices for the selected language", async () => {
    for (const [language, expected] of [["ja", "￥7,500"], ["en", "US$50.00"]]) {
        const test = discovery();
        test.sandbox.i18nLang = () => language;
        const offer = structuredClone(Object.values(catalogue)[0]);
        offer.builtIn = true;
        offer.plans.basic.planComponents.recurrentBillingTerms[0] = { price: 50, currency: "USD", termUnit: "P1M" };
        test.sandbox.fetch = async () => ({ ok: true, json: async () => ({ [offer.offerId]: offer }) });
        await test.start();
        assert.equal(test.nodes.get("product-price").textContent, expected);
        assert.equal(test.nodes.get("plan-cards").children[0].children[1].textContent, expected + " · experience.monthly");
    }
});

check("product entry never offers checkout when the selected catalogue plan has no price", async () => {
    const test = discovery();
    const offer = structuredClone(Object.values(catalogue)[0]);
    delete offer.plans.basic.planComponents;
    test.sandbox.fetch = async () => ({ ok: true, json: async () => ({ [offer.offerId]: offer }) });
    await test.start();
    assert.equal(test.nodes.get("product-price").textContent, "experience.noPrice");
    assert.equal(test.nodes.get("discovery-continue").disabled, true);
    test.nodes.get("discovery-form").listeners.submit({ preventDefault() {} });
    assert.equal(test.sandbox.location.pathname, "/start.html");
    test.nodes.get("discovery-plan").value = "team & annual";
    test.nodes.get("discovery-plan").listeners.change();
    assert.equal(test.nodes.get("discovery-continue").disabled, false);
    assert.equal(test.nodes.get("product-price").textContent, "£415.00");
});

check("landing URL preserves existing query/hash and the exact token beside metadata", () => {
    const test = runtime("?scenario=web-azure", "ja");
    const target = new URL(test.sandbox.PurchaseJourney.landingUrl(
        "https://publisher.example/landing?existing=a%2Bb&token=old&culture=en#configure",
        "opaque+token/with=="
    ));
    assert.equal(target.pathname, "/landing");
    assert.equal(target.searchParams.get("existing"), "a+b");
    assert.equal(target.hash, "#configure");
    // Native URL arrays can belong to a different realm under Jest.
    const tokens = target.searchParams.getAll("token");
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0], "opaque+token/with==");
    assert.equal(target.searchParams.get("scenario"), "web-azure");
    assert.equal(target.searchParams.get("culture"), "ja");
});

check("direct checkout does not invent a scenario", () => {
    const test = runtime();
    const target = new URL(test.sandbox.PurchaseJourney.landingUrl("https://publisher.example", "token"));
    assert.equal(target.searchParams.has("scenario"), false);
    assert.equal(target.searchParams.get("culture"), "en");
});

check("checkout boot selects the exact discovery offer/plan without extra purchase requests", async () => {
    for (const scenario of ["web-card", "web-azure", "azure-portal"]) {
        const params = new URLSearchParams({ scenario, offer: "existing/offer & one", plan: "team & annual" });
        const test = checkout("?" + params);
        await test.start();
        const plans = test.sandbox.$("section.purchase select");
        assert.equal(plans.val(), "team & annual");
        assert.equal(plans.data("offer"), catalogue["existing/offer & one"]);
        assert.equal(test.state.get("section.purchase .seat-count").visibility, "visible");
        assert.equal(test.state.get("#checkout-route").text, `journey.${scenario}.route`);
        assert.equal(test.state.get("#checkout-prerequisites").text, `journey.${scenario}.prerequisites`);
        assert.equal(test.state.get("#purchaseButton").disabled, false);
        assert.equal(test.sandbox.$("#purchaserOid").val(), "unchanged-demo-guid");
        assert.equal(test.sandbox.$("#beneficiaryOid").val(), "unchanged-demo-guid");
        assert.deepEqual(test.requests, ["/api/util/config", "/api/util/offers"]);
        test.sandbox.$("#quantity").val("8");
        plans.val("basic").trigger("change");
        assert.equal(test.sandbox.location.searchParams.get("plan"), "basic");
        assert.equal(test.state.get("section.purchase .seat-count").visibility, "hidden");
    }
});

check("direct checkout remains usable without scenario or preselection", async () => {
    const test = checkout();
    await test.start();
    assert.equal(test.rendered.length, 1);
    assert.equal(test.state.get("#checkout-route").text, "journey.directTitle");
    test.rendered[0].action();
    assert.equal(test.sandbox.$("section.purchase select").val(), "basic");
    assert.equal(test.state.get("#purchaseButton").disabled, false);
    assert.equal(test.sandbox.location.searchParams.has("scenario"), false);
});

check("checkout keeps configuration errors visible after selecting an offer", async () => {
    const test = checkout("?offer=" + encodeURIComponent("existing/offer & one"));
    test.sandbox.callAPI = async () => { throw new Error("offline"); };
    await test.start();
    assert.equal(test.state.get("#checkout-error").text, "index.configError");
    assert.equal(test.state.get("#checkout-error").hidden, false);
});

check("checkout catalogue failures and empty plans cannot masquerade as ready checkout", async () => {
    const failed = checkout();
    failed.sandbox.fetch = async () => ({ ok: false });
    await failed.start();
    assert.equal(failed.state.get("#checkout-error").text, "journey.catalogueError");
    assert.equal(failed.state.get("section.purchase").hidden, true);
    assert.equal(failed.rendered.length, 0);

    const noPlans = checkout("?offer=empty");
    noPlans.sandbox.fetch = async () => ({
        ok: true, json: async () => ({ empty: { offerId: "empty", displayName: "Empty", publisher: "Demo", plans: {} } })
    });
    await noPlans.start();
    assert.equal(noPlans.state.get("#checkout-error").text, "journey.noPlans");
    assert.equal(noPlans.state.get("#purchaseButton").disabled, true);
});

check("existing i18n strips only culture, preserves selection, and respects a later language toggle", () => {
    const test = runtime("?culture=ja&scenario=azure-portal&offer=existing&plan=team#selection");
    test.load("i18n.js");
    assert.equal(test.sandbox.i18nLang(), "ja");
    assert.equal(test.sandbox.location.searchParams.has("culture"), false);
    assert.equal(test.sandbox.location.searchParams.get("scenario"), "azure-portal");
    assert.equal(test.sandbox.location.searchParams.get("offer"), "existing");
    assert.equal(test.sandbox.location.hash, "#selection");
    test.sandbox.localStorage.setItem("emu-lang", "en");
    test.load("i18n.js");
    assert.equal(test.sandbox.i18nLang(), "en");
    const target = test.sandbox.PurchaseJourney.withContext("/subscriptions.html");
    assert.equal(target.searchParams.get("culture"), "en");
    assert.equal(target.searchParams.get("scenario"), "azure-portal");
});

check("internal navigation and publisher glossary links retain scenario and culture", () => {
    const test = runtime("?scenario=web-card", "ja");
    const internal = new Element("a");
    internal.setAttribute("href", "/subscriptions.html");
    const learn = new Element("a");
    learn.setAttribute("href", "https://publisher.example/?keep=yes#how");
    learn.closest = () => true;
    const external = new Element("a");
    external.setAttribute("href", "https://github.com/microsoft");
    test.sandbox.document.querySelectorAll = () => [internal, learn, external];
    test.ready[0]();
    for (const a of [internal, learn]) {
        const target = new URL(a.href);
        assert.equal(target.searchParams.get("culture"), "ja");
        assert.equal(target.searchParams.get("scenario"), "web-card");
    }
    assert.equal(new URL(learn.href).hash, "#how");
    assert.equal(new URL(learn.href).searchParams.get("keep"), "yes");
    assert.equal(external.href, undefined);
});

for (const [name, response, message] of [
    ["empty catalogue", { ok: true, json: async () => ({}) }, "journey.noOffers"],
    ["HTTP error", { ok: false }, "journey.catalogueError"],
    ["invalid JSON", { ok: true, json: async () => { throw new SyntaxError("invalid"); } }, "journey.catalogueError"],
    ["invalid catalogue", { ok: true, json: async () => [] }, "journey.catalogueError"],
    ["malformed offer", { ok: true, json: async () => ({ wrong: { offerId: "wrong" } }) }, "journey.catalogueError"],
    ["no plans", { ok: true, json: async () => ({ only: { offerId: "only", displayName: "Only", publisher: "Demo", plans: {} } }) }, "journey.noPlans"]
]) {
    check(`${name}: explicit error, no invented offer and no checkout`, async () => {
        const test = discovery();
        test.sandbox.fetch = async () => response;
        await test.start();
        assert.equal(test.nodes.get("catalogue-error").hidden, false);
        assert.equal(test.nodes.get("catalogue-error-message").textContent, message);
        assert.equal(test.nodes.get("discovery-continue").disabled, true);
        assert.equal(test.nodes.get("catalogue-status").hidden, true);
        test.nodes.get("discovery-form").listeners.submit({ preventDefault() {} });
        assert.equal(test.sandbox.location.pathname, "/start.html");
    });
}

check("network failure stays an explicit error", async () => {
    const test = discovery();
    test.sandbox.fetch = async () => { throw new Error("offline"); };
    await test.start();
    assert.equal(test.nodes.get("catalogue-error-message").textContent, "journey.catalogueError");
    assert.equal(test.nodes.get("discovery-continue").disabled, true);
});

check("invalid offer/plan does not silently purchase a different selection", async () => {
    const test = discovery("?offer=missing&plan=missing");
    await test.start();
    assert.equal(test.nodes.get("catalogue-error-message").textContent, "journey.selectionError");
    assert.equal(test.nodes.get("discovery-offer").selectedIndex, -1);
    assert.equal(test.nodes.get("discovery-continue").disabled, true);
    const offers = Object.values(catalogue);
    for (const planId of ["missing", "__proto__", "constructor"]) {
        assert.throws(() => test.sandbox.PurchaseJourney.selection(offers, offers[0].offerId, planId), /journey.selectionError/);
    }
    assert.equal(test.sandbox.PurchaseJourney.selection(offers, null, null), null);
    test.nodes.get("discovery-offer").value = offers[0].offerId;
    test.nodes.get("discovery-offer").listeners.change();
    assert.equal(test.nodes.get("catalogue-error").hidden, true);
    assert.equal(test.nodes.get("discovery-continue").disabled, false);
});

check("selection persistence removes a stale plan when an offer has no plans", () => {
    const test = runtime("?offer=old&plan=old&scenario=web-azure#listing");
    test.sandbox.PurchaseJourney.updateSelection("new", "");
    assert.equal(test.sandbox.location.searchParams.get("offer"), "new");
    assert.equal(test.sandbox.location.searchParams.has("plan"), false);
    assert.equal(test.sandbox.location.searchParams.get("scenario"), "web-azure");
    assert.equal(test.sandbox.location.hash, "#listing");
});

check("catalogue display uses text rather than interpreting product names as HTML", async () => {
    const test = discovery();
    const offer = structuredClone(Object.values(catalogue)[0]);
    offer.displayName = '<img src=x onerror="alert(1)">';
    offer.publisher = "<script>untrusted</script>";
    test.sandbox.fetch = async () => ({ ok: true, json: async () => ({ [offer.offerId]: offer }) });
    await test.start();
    assert.equal(test.nodes.get("product-name").textContent, offer.displayName);
    assert.equal(test.nodes.get("product-name").innerHTML, undefined);
    assert.equal(test.nodes.get("product-publisher").textContent, offer.publisher);
});

check("four-step map keeps discovery at buyer step 1 and carries glossary context", async () => {
    const test = runtime("?scenario=web-azure", "ja");
    let mounted;
    const anchor = { parentNode: { insertBefore: map => { mounted = map; } }, nextSibling: null };
    test.sandbox.document.body.setAttribute("data-demo-step", "1");
    test.sandbox.document.querySelector = selector => selector === "p.page-hint" ? anchor : null;
    test.sandbox.fetch = async () => ({ ok: true, json: async () => ({ landingPageUrl: "https://publisher.example/landing?existing=yes" }) });
    test.load("demo-map.js");
    test.ready[test.ready.length - 1]();
    for (let i = 0; i < 6; i++) await Promise.resolve();
    const steps = mounted.children[0].children;
    assert.equal(steps.length, 4);
    assert.equal(steps[0].getAttribute("aria-current"), "step");
    assert.equal(steps[0].className, "step current");
    assert.equal(steps[1].className, "step external");
    assert.equal(steps[2].className, "step external");
    assert.equal(steps[3].className, "step");
    assert.equal(steps[0].children[2].children[1].getAttribute("data-i18n"), "map.whoBuyer");
    assert.equal(steps.slice(1).every(step => step.children.length === 1), true);
    assert.equal(new URL(steps[0].children[0].href).pathname, "/start.html");
    const learn = new URL(mounted.children[2].children[0].href);
    assert.equal(learn.hash, "#how");
    assert.equal(learn.searchParams.get("culture"), "ja");
    assert.equal(learn.searchParams.get("scenario"), "web-azure");
});

check("map is still rendered when publisher config is unavailable", async () => {
    const test = runtime();
    let mounted;
    const anchor = { parentNode: { insertBefore: map => { mounted = map; } }, nextSibling: null };
    test.sandbox.document.querySelector = selector => selector === "p.page-hint" ? anchor : null;
    test.sandbox.fetch = async () => { throw new Error("offline"); };
    test.load("demo-map.js");
    test.ready[test.ready.length - 1]();
    for (let i = 0; i < 6; i++) await Promise.resolve();
    assert.equal(mounted.children[0].children.length, 4);
    assert.equal(mounted.children[0].children[1].children[0].tag, "span");
});

check("all scenarios leave generateToken payload identical and Continue adds no API request", async () => {
    let originalJson;
    for (const scenario of ["web-card", "web-azure", "azure-portal", "invalid", ""]) {
        const test = runtime("?scenario=" + scenario, "ja");
        const fields = {
            "#subscriptionId": "existing-demo-id", "#subscriptionName": "Demo",
            "#beneficiaryEmail": "beneficiary@example.test", "#beneficiaryOid": "beneficiary-oid",
            "#beneficiaryTid": "beneficiary-tid", "#purchaserEmail": "purchaser@example.test",
            "#purchaserOid": "purchaser-oid", "#purchaserTid": "purchaser-tid", "#quantity": "7"
        };
        test.sandbox.$ = selector => {
            if (typeof selector === "function") return;
            return {
                is: () => true,
                val: () => selector === "section.purchase select" ? "team & annual" : fields[selector],
                data: () => Object.values(catalogue)[0]
            };
        };
        let apiCalls = 0;
        let target;
        test.sandbox.callAPI = () => { apiCalls++; };
        test.sandbox.open = url => { target = new URL(url); };
        test.load("index.js");
        vm.runInContext('config = { landingPageUrl: "https://publisher.example/landing?existing=yes#configure" };', test.context);
        const result = test.sandbox.generateToken();
        const payload = JSON.parse(result.json);
        assert.equal(Buffer.from(result.base64, "base64").toString(), result.json);
        if (originalJson) assert.equal(result.json, originalJson);
        originalJson = result.json;
        assert.equal(payload.offerId, "existing/offer & one");
        assert.equal(payload.planId, "team & annual");
        assert.equal(payload.quantity, 7);
        assert.equal(payload.purchaser.objectId, "purchaser-oid");
        assert.equal(payload.beneficiary.objectId, "beneficiary-oid");
        assert.deepEqual(Object.keys(payload), ["id", "name", "offerId", "planId", "beneficiary", "purchaser", "quantity", "autoRenew", "isTest", "isFreeTrial"]);
        let generations = 0;
        const generate = test.sandbox.generateToken;
        test.sandbox.generateToken = () => { generations++; return generate(); };
        await test.sandbox.postToLanding();
        assert.equal(generations, 1);
        assert.equal(apiCalls, 0);
        assert.equal(target.searchParams.get("token"), result.base64);
        assert.equal(target.searchParams.get("scenario"), ["web-card", "web-azure", "azure-portal"].includes(scenario) ? scenario : null);
        assert.equal(target.searchParams.get("culture"), "ja");
        assert.equal(target.searchParams.get("existing"), "yes");
        assert.equal(target.hash, "#configure");
    }
});

check("new text has JP/EN pairs, markup labels, viewport and shared map assets", () => {
    const test = runtime();
    test.load("i18n.js");
    const { en, ja } = test.sandbox.I18N;
    for (const key of Object.keys(en).filter(key => key.startsWith("journey.") || key.startsWith("experience."))) {
        assert.ok(en[key] && ja[key], key);
    }
    for (const file of ["start.html", "index.html", "checkout.html"]) {
        const html = source(file);
        assert.match(html, /name="viewport"/);
        assert.match(html, /data-demo-step="1"/);
        assert.match(html, /src="purchase-journey.js"/);
        assert.match(html, /src="demo-map.js"/);
        for (const [, key] of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) {
            assert.ok(en[key] && ja[key], `${file}: ${key}`);
        }
        for (const [, attributes] of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
            for (const attribute of attributes.split(";")) {
                const key = attribute.split(":")[1];
                assert.ok(en[key] && ja[key], `${file}: ${key}`);
            }
        }
        for (const [, id] of html.matchAll(/<(?:input|select)[^>]+id="([^"]+)"/g)) {
            if (id === "subscriptionId") continue;
            const wrappingLabel = new RegExp(`<label\\b[^>]*>(?:(?!<\\/label>)[\\s\\S])*<(?:input|select)\\b[^>]*id="${id}"`);
            assert.ok(html.includes(`for="${id}"`) || wrappingLabel.test(html), `${file}: missing label for ${id}`);
        }
    }
    for (const name of ["purchase-journey.js", "purchase-experience.js", "start.js", "checkout.js", "index.js", "demo-map.js", "i18n.js"]) {
        assert.doesNotThrow(() => new vm.Script(source(name), { filename: name }));
    }
});

check("product detail is the primary entry, presenter controls start collapsed, and legacy technical form remains linked", () => {
    const html = source("start.html");
    const controls = html.match(/<details\b([^>]*class="presenter-tools"[^>]*)>([\s\S]*?)<\/details>/);
    assert.ok(controls, "Presenter controls are a collapsible details element");
    assert.doesNotMatch(controls[1], /\bopen\b/);
    assert.match(controls[2], /name="scenario" value="web-card"/);
    assert.match(controls[2], /name="scenario" value="web-azure"/);
    assert.match(controls[2], /name="scenario" value="azure-portal"/);
    assert.match(controls[2], /id="discovery-offer"/);
    assert.match(controls[2], /href="\/"[^>]*data-i18n="experience.technicalForm"/);
    assert.doesNotMatch(controls[2], /id="discovery-continue"/);
    assert.match(html, /class="product-hero"/);
    assert.match(html, /id="product-price"/);
    const checkoutHtml = source("checkout.html");
    assert.match(checkoutHtml, /id="place-order"[^>]*data-i18n="experience.placeOrder"/);
    assert.match(checkoutHtml, /data-i18n="experience.orderComplete"/);
    assert.match(checkoutHtml, /id="configure-account"[^>]*data-i18n="experience.configure"/);
    assert.match(checkoutHtml, /data-i18n="experience.simulationRecord"/);
    assert.doesNotMatch(checkoutHtml, /autocomplete="cc-|(?:name|id)="(?:card-number|cvv|cvc)"/);
});

module.exports = cases;

// The same assertions can run without installing a second runner when npm is unavailable.
if (require.main === module) {
    (async () => {
        for (const [name, run] of cases) {
            await run();
            console.log("PASS " + name);
        }
        console.log(`${cases.length} client regression cases passed.`);
    })().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
