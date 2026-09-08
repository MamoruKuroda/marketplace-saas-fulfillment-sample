const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { TextEncoder } = require("node:util");
const { webcrypto } = require("node:crypto");

const client = path.join(__dirname, "..", "client");
const source = name => fs.readFileSync(path.join(client, name), "utf8");
const cases = [];
const check = (name, run) => cases.push([name, run]);
const catalogue = {
    offer: {
        offerId: "offer", displayName: "Catalogue workspace", publisher: "Demo publisher",
        plans: {
            team: {
                displayName: "Team", isPricePerSeat: true,
                planComponents: { recurrentBillingTerms: [
                    { price: 13, currency: "GBP", termUnit: "P1M" },
                    { price: 117, currency: "EUR", termUnit: "P1Y" }
                ] }
            },
            flat: {
                displayName: "Flat", isPricePerSeat: false,
                planComponents: { recurrentBillingTerms: [{ price: 470, currency: "JPY", termUnit: "P1M" }] }
            },
            unconfigured: { displayName: "Unconfigured", isPricePerSeat: false }
        }
    }
};

class Element {
    constructor(tag, id = "") {
        this.tag = tag;
        this.id = id;
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.dataset = {};
        this.hidden = false;
        this.disabled = false;
        this.checked = false;
        this.rawValue = "";
        this.selectedIndex = 0;
        this.textContent = "";
        this.className = "";
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
        return this.tag === "select" ? this.children[this.selectedIndex]?.value || "" : this.rawValue;
    }
    set value(value) {
        if (this.tag === "select") this.selectedIndex = this.children.findIndex(node => node.value === String(value));
        else this.rawValue = String(value);
    }
    set href(value) { this.setAttribute("href", value); }
    get href() { return this.getAttribute("href"); }
    appendChild(node) { this.children.push(node); return node; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    replaceChildren() { this.children = []; this.selectedIndex = 0; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    focus() { this.focused = true; }
    scrollIntoView() {}
}

function runtime(options = {}) {
    const html = source("checkout.html");
    const nodes = new Map();
    const ready = [];
    const listeners = {};
    const requests = [];
    const storage = options.storage || new Map();
    const byId = id => {
        assert.ok(nodes.has(id), `Controller requested missing markup #${id}`);
        return nodes.get(id);
    };
    for (const [, tag, attributes, id] of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const node = new Element(tag, id);
        node.hidden = /\bhidden\b/.test(attributes);
        node.disabled = /\bdisabled\b/.test(attributes);
        for (const [, name, value] of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(name, value);
        nodes.set(id, node);
    }
    for (const [, id, body] of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
        for (const [, value] of body.matchAll(/<option\b[^>]*\bvalue="([^"]*)"/g)) {
            const option = new Element("option");
            option.value = value;
            byId(id).appendChild(option);
        }
    }
    const progress = Array.from(html.matchAll(/data-stage="([^"]+)"/g), ([, stage]) => {
        const node = new Element("span");
        node.dataset.stage = stage;
        return node;
    });
    const headings = new Map();
    const document = {
        readyState: "loading",
        body: new Element("body"),
        addEventListener: (_name, handler) => ready.push(handler),
        getElementById: byId,
        createElement: tag => new Element(tag),
        querySelector: selector => {
            if (!/^#(?:portal-redirect|checkout-(?:details|review|complete)) h2$/.test(selector)) return null;
            if (!headings.has(selector)) headings.set(selector, new Element("h2"));
            return headings.get(selector);
        },
        querySelectorAll: selector => {
            if (selector === ".checkout-progress [data-stage]") return progress;
            if (selector === "#web-billing select") return [byId("billing-profile"), byId("payment-method")];
            if (selector === "#azure-project select") return [byId("azure-subscription"), byId("resource-group")];
            return [];
        }
    };
    byId("checkout-form").querySelectorAll = selector => {
        assert.equal(selector, "[aria-invalid]");
        return Array.from(nodes.values()).filter(node => node.getAttribute("aria-invalid") !== null);
    };
    const location = new URL(options.url ||
        `https://emulator.example/checkout.html?offer=offer&plan=team&scenario=${options.scenario || "web-card"}`);
    const sandbox = {
        URL, URLSearchParams, TextEncoder, Uint8Array, document, location,
        crypto: { getRandomValues: bytes => webcrypto.getRandomValues(bytes) },
        btoa: text => Buffer.from(text, "binary").toString("base64"),
        i18nLang: () => options.language || "en",
        t: key => key,
        addEventListener: (name, handler) => { listeners[name] = handler; },
        sessionStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value)
        },
        fetch: async (url, request = {}) => {
            requests.push({ url, method: request.method || "GET" });
            if (options.fetch) return options.fetch(url);
            if (url === "/api/util/offers") return { ok: true, json: async () => options.catalogue || catalogue };
            if (url === "/api/util/config") return {
                ok: true, json: async () => options.config || {
                    landingPageUrl: "https://publisher.example/landing?existing=yes#configure"
                }
            };
            throw new Error(`Unexpected backend request: ${url}`);
        }
    };
    const navigate = (_state, _title, target) => { location.href = new URL(target, location).href; };
    sandbox.history = { pushState: navigate, replaceState: navigate };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    for (const name of ["purchase-journey.js", "purchase-experience.js", "checkout.js"]) {
        vm.runInContext(source(name), context, { filename: name });
    }
    return {
        sandbox, nodes, storage, location, requests, progress,
        start: () => ready[ready.length - 1](),
        click: id => byId(id).listeners.click(),
        submit: () => byId("checkout-form").listeners.submit({ preventDefault() {} }),
        input: (id, value) => {
            if (id === "accept-terms") byId(id).checked = value;
            else byId(id).value = value;
            byId("checkout-form").listeners.input({ target: byId(id) });
        },
        pop: stage => {
            location.searchParams.set("stage", stage);
            listeners.popstate();
        },
        popUrl: target => {
            location.href = target;
            listeners.popstate();
        },
        saved: () => JSON.parse(storage.get("marketplace-purchase-demo:" + location.searchParams.get("draft")))
    };
}

function assertStage(test, stage) {
    assert.equal(test.location.searchParams.get("stage"), stage);
    assert.equal(test.nodes.get("portal-redirect").hidden, stage !== "redirect");
    assert.equal(test.nodes.get("checkout-surface").hidden, stage === "redirect");
    for (const value of ["details", "review", "complete"]) {
        assert.equal(test.nodes.get("checkout-" + value).hidden, stage !== value);
        assert.equal(test.progress.find(node => node.dataset.stage === value).getAttribute("aria-current"),
            stage === value ? "step" : null);
    }
}

function reviewValidOrder(test) {
    test.input("subscriptionName", "研究開発チーム 🚀");
    test.input("quantity", 4);
    test.input("billing-term", 1);
    test.input("accept-terms", true);
    test.submit();
}

for (const scenario of ["web-card", "web-azure", "azure-portal"]) {
    check(`${scenario}: distinct purchase screen, explicit review/confirmation, then unchanged token handoff`, async () => {
        const test = runtime({ scenario });
        await test.start();
        assert.equal(test.saved().confirmation, null);
        assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
        if (scenario === "web-azure") {
            assertStage(test, "redirect");
            test.click("place-order");
            assert.equal(test.saved().confirmation, null);
            test.click("continue-azure");
        }
        assertStage(test, "details");
        const azure = scenario !== "web-card";
        assert.equal(test.nodes.get("web-billing").hidden, azure);
        assert.equal(test.nodes.get("azure-project").hidden, !azure);
        assert.equal(test.nodes.get("billing-profile").disabled, azure);
        assert.equal(test.nodes.get("payment-method").disabled, azure);
        assert.equal(test.nodes.get("azure-subscription").disabled, !azure);
        assert.equal(test.nodes.get("resource-group").disabled, !azure);
        test.click("place-order");
        assert.equal(test.saved().confirmation, null);
        test.input(azure ? "azure-subscription" : "billing-profile", azure ? "sandbox" : "company");
        test.input(azure ? "resource-group" : "payment-method", azure ? "evaluation" : "team");
        reviewValidOrder(test);
        assertStage(test, "review");
        assert.equal(test.saved().confirmation, null);
        assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
        assert.equal(test.nodes.get("summary-total").textContent, "€468.00");
        const review = test.nodes.get("review-details").children.map(node => node.textContent);
        assert.ok(review.includes(azure ? "experience.azureSubscription" : "experience.billingProfile"));
        assert.ok(review.includes(azure ? "demo-evaluation" : "experience.teamCard"));
        assert.equal(review.includes(azure ? "experience.paymentMethod" : "experience.resourceGroup"), false);
        test.click("place-order");
        assertStage(test, "complete");
        const firstHref = test.nodes.get("configure-account").href;
        const target = new URL(firstHref);
        assert.equal(target.origin, "https://publisher.example");
        assert.equal(target.searchParams.get("existing"), "yes");
        assert.equal(target.hash, "#configure");
        assert.equal(target.searchParams.get("scenario"), scenario);
        const tokens = target.searchParams.getAll("token");
        assert.equal(tokens.length, 1);
        const token = tokens[0];
        const order = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
        assert.equal(order.name, "研究開発チーム 🚀");
        assert.equal(order.offerId, "offer");
        assert.equal(order.planId, "team");
        assert.equal(order.quantity, 4);
        assert.deepEqual(Object.keys(order),
            ["id", "name", "offerId", "planId", "beneficiary", "purchaser", "quantity", "autoRenew", "isTest", "isFreeTrial"]);
        assert.equal(order.autoRenew, false);
        assert.equal(order.isTest, false);
        assert.equal(order.isFreeTrial, false);
        assert.equal(order.id, test.saved().confirmation.id);
        assert.equal(token, test.sandbox.PurchaseJourney.purchaseToken(test.saved().confirmation).base64);
        test.click("place-order");
        assert.equal(test.nodes.get("configure-account").href, firstHref);
        assert.deepEqual(test.requests, [
            { url: "/api/util/offers", method: "GET" }, { url: "/api/util/config", method: "GET" }
        ]);
    });
}

check("invalid name, seat quantity, period, consent and synthetic selections block review with field errors", async () => {
    for (const [scenario, field, value] of [
        ["web-card", "subscriptionName", "   "], ["web-card", "quantity", "1.5"],
        ["web-card", "billing-profile", "real-account"], ["web-card", "payment-method", "4111111111111111"],
        ["azure-portal", "azure-subscription", "readonly"], ["azure-portal", "resource-group", "production"],
        ["web-card", "accept-terms", false]
    ]) {
        const test = runtime({ scenario });
        await test.start();
        test.input("accept-terms", true);
        test.input(field, value);
        test.submit();
        assertStage(test, "details");
        assert.equal(test.nodes.get("checkout-error").hidden, false);
        assert.equal(test.nodes.get(field).getAttribute("aria-invalid"), "true", field);
        assert.equal(test.nodes.get(field).focused, true, field);
        assert.equal(test.saved().confirmation, null);
        assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
    }
});

check("editing review returns to details and refreshes the actual catalogue total and handoff selection", async () => {
    const test = runtime();
    await test.start();
    reviewValidOrder(test);
    assertStage(test, "review");
    test.click("edit-order");
    assertStage(test, "details");
    test.input("purchase-plan", "flat");
    assert.equal(test.nodes.get("quantity-field").hidden, true);
    assert.equal(test.nodes.get("quantity").disabled, true);
    assert.equal(test.nodes.get("summary-total").textContent, "¥470");
    assert.equal(test.nodes.get("billing-term").options.length, 1);
    assert.equal(test.location.searchParams.get("plan"), "flat");
    assert.equal(new URL(test.nodes.get("back-product").href).searchParams.get("plan"), "flat");
    test.submit();
    test.click("place-order");
    const token = new URL(test.nodes.get("configure-account").href).searchParams.get("token");
    const order = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    assert.equal(order.planId, "flat");
    assert.equal(order.quantity, null);
});

check("unconfigured plan has no fabricated total and cannot progress to review or confirmation", async () => {
    const test = runtime();
    await test.start();
    test.input("purchase-plan", "unconfigured");
    test.input("accept-terms", true);
    assert.equal(test.nodes.get("billing-term").options.length, 0);
    assert.equal(test.nodes.get("review-button").disabled, true);
    assert.equal(test.nodes.get("summary-total").textContent, "experience.noPrice");
    test.submit();
    assertStage(test, "details");
    assert.equal(test.nodes.get("billing-term").getAttribute("aria-invalid"), "true");
    assert.equal(test.saved().confirmation, null);
});

check("per-tab reload restores draft choices and Japanese locale while preserving the exact completed token", async () => {
    const test = runtime({ scenario: "azure-portal" });
    await test.start();
    test.input("azure-subscription", "sandbox");
    test.input("resource-group", "evaluation");
    reviewValidOrder(test);
    const reviewReload = runtime({ url: test.location.href, storage: test.storage, language: "ja" });
    await reviewReload.start();
    assertStage(reviewReload, "review");
    assert.equal(reviewReload.nodes.get("subscriptionName").value, "研究開発チーム 🚀");
    assert.equal(reviewReload.nodes.get("azure-subscription").value, "sandbox");
    assert.equal(reviewReload.nodes.get("resource-group").value, "evaluation");
    assert.equal(reviewReload.nodes.get("quantity").value, "4");
    assert.equal(reviewReload.nodes.get("billing-term").value, "1");
    reviewReload.click("place-order");
    const confirmedToken = new URL(reviewReload.nodes.get("configure-account").href).searchParams.get("token");
    const completeReload = runtime({ url: reviewReload.location.href, storage: reviewReload.storage, language: "en" });
    await completeReload.start();
    assertStage(completeReload, "complete");
    const landing = new URL(completeReload.nodes.get("configure-account").href);
    assert.equal(landing.searchParams.get("token"), confirmedToken);
    assert.equal(landing.searchParams.get("culture"), "en");
    assert.equal(new URL(reviewReload.nodes.get("configure-account").href).searchParams.get("culture"), "ja");
    assert.equal(completeReload.saved().confirmation.id, reviewReload.saved().confirmation.id);
});

check("bare completion/review URLs or another tab never display an order that was not confirmed", async () => {
    for (const stage of ["review", "complete"]) {
        const url = `https://emulator.example/checkout.html?offer=offer&plan=team&scenario=web-card&stage=${stage}`;
        const test = runtime({ url });
        await test.start();
        assertStage(test, "details");
        assert.equal(test.nodes.get("checkout-error").textContent, "experience.draftExpired");
        assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
    }
    const first = runtime();
    await first.start();
    reviewValidOrder(first);
    first.click("place-order");
    const anotherTab = runtime({ url: first.location.href });
    await anotherTab.start();
    assertStage(anotherTab, "details");
    assert.equal(anotherTab.saved().confirmation, null);
});

check("corrupt, mismatched and incomplete saved confirmations cannot create a false success page", async () => {
    const first = runtime();
    await first.start();
    reviewValidOrder(first);
    const key = "marketplace-purchase-demo:" + first.location.searchParams.get("draft");
    const saved = first.saved();
    const url = new URL(first.location.href);
    url.searchParams.set("stage", "complete");
    for (const stored of [
        "{not json", JSON.stringify({ ...saved, schema: 99 }),
        JSON.stringify({ ...saved, scenario: "azure-portal" }),
        JSON.stringify({ ...saved, planId: "flat" }),
        JSON.stringify({ ...saved, confirmation: { id: "pretend" } }),
        JSON.stringify(saved)
    ]) {
        const test = runtime({ url: url.href, storage: new Map([[key, stored]]) });
        await test.start();
        assertStage(test, "details");
        assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
        assert.equal(test.nodes.get("checkout-error").hidden, false);
    }
});

check("browser back navigation cannot bypass review or create confirmation and edits invalidate an old order", async () => {
    const test = runtime();
    await test.start();
    test.pop("complete");
    assertStage(test, "details");
    assert.equal(test.saved().confirmation, null);
    reviewValidOrder(test);
    test.click("place-order");
    const firstId = test.saved().confirmation.id;
    test.pop("details");
    test.input("subscriptionName", "Edited purchase");
    assert.equal(test.saved().confirmation, null);
    assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
    test.pop("complete");
    assertStage(test, "details");
    test.submit();
    test.click("place-order");
    assertStage(test, "complete");
    assert.notEqual(test.saved().confirmation.id, firstId);
});

check("back to an older review URL preserves the active edited plan through confirmation and reload", async () => {
    const test = runtime();
    await test.start();
    reviewValidOrder(test);
    const oldReview = test.location.href;
    assert.equal(new URL(oldReview).searchParams.get("plan"), "team");
    test.click("edit-order");
    test.input("purchase-plan", "flat");
    test.popUrl(oldReview);
    assertStage(test, "review");
    assert.equal(test.location.searchParams.get("offer"), "offer");
    assert.equal(test.location.searchParams.get("plan"), "flat");
    assert.equal(test.saved().planId, "flat");
    assert.equal(test.nodes.get("summary-plan").textContent, "Flat");
    test.click("place-order");
    assertStage(test, "complete");
    assert.equal(test.location.searchParams.get("plan"), "flat");
    const frozen = new URL(test.nodes.get("configure-account").href).searchParams.get("token");
    const reloaded = runtime({ url: test.location.href, storage: test.storage });
    await reloaded.start();
    assertStage(reloaded, "complete");
    assert.equal(reloaded.nodes.get("purchase-plan").value, "flat");
    assert.equal(new URL(reloaded.nodes.get("configure-account").href).searchParams.get("token"), frozen);
});

check("non-localhost HTTP checkout generates draft, party and order UUIDs without randomUUID", async () => {
    const test = runtime({ url: "http://emulator.example/checkout.html?offer=offer&plan=team&scenario=web-card" });
    assert.equal(test.sandbox.crypto.randomUUID, undefined);
    await test.start();
    reviewValidOrder(test);
    test.click("place-order");
    assertStage(test, "complete");
    const order = test.saved().confirmation;
    const identifiers = [
        test.location.searchParams.get("draft"), order.id,
        order.beneficiary.objectId, order.beneficiary.tenantId
    ];
    for (const id of identifiers) {
        assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    assert.equal(new Set(identifiers).size, identifiers.length);
    assert.equal(order.purchaser.objectId, order.beneficiary.objectId);
    assert.equal(order.purchaser.tenantId, order.beneficiary.tenantId);
});

check("storage failure blocks completion rather than creating a nonpersistent confirmation", async () => {
    const test = runtime();
    await test.start();
    reviewValidOrder(test);
    test.sandbox.sessionStorage.setItem = () => { throw new Error("storage quota exceeded"); };
    test.click("place-order");
    assertStage(test, "review");
    assert.equal(test.nodes.get("checkout-error").textContent, "experience.storageError");
    assert.equal(test.saved().confirmation, null);
    assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
});

check("initial draft write failure clears loading and never presents a usable purchase screen", async () => {
    const test = runtime();
    test.sandbox.sessionStorage.setItem = () => { throw new Error("storage writes denied"); };
    await test.start();
    assert.equal(test.nodes.get("checkout-error").textContent, "experience.storageError");
    assert.equal(test.nodes.get("checkout-error").hidden, false);
    assert.equal(test.nodes.get("checkout-loading").hidden, true);
    assert.equal(test.nodes.get("checkout-surface").hidden, true);
    assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
    assert.equal(test.storage.size, 0);
});

check("catalogue, selection, storage and landing configuration failures expose no usable checkout", async () => {
    for (const options of [
        { url: "https://emulator.example/checkout.html?offer=missing&plan=team" },
        { url: "https://emulator.example/checkout.html?offer=offer&plan=missing" },
        { url: "https://emulator.example/checkout.html" },
        { fetch: async () => ({ ok: false }) },
        { fetch: async () => { throw new Error("offline"); } },
        { config: {} },
        { config: { landingPageUrl: "javascript:alert(1)" } },
        { config: { landingPageUrl: "https://user:secret@publisher.example" } },
        { config: { landingPageUrl: "http://localhost:3000" } }
    ]) {
        const test = runtime(options);
        await test.start();
        assert.equal(test.nodes.get("checkout-error").hidden, false);
        assert.equal(test.nodes.get("checkout-loading").hidden, true);
        assert.equal(test.nodes.get("checkout-surface").hidden, true);
        assert.equal(test.nodes.get("checkout-complete").hidden, true);
        assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
        assert.equal(test.storage.size, 0);
    }
    const denied = runtime();
    denied.sandbox.sessionStorage.getItem = () => { throw new Error("storage denied"); };
    await denied.start();
    assert.equal(denied.nodes.get("checkout-error").textContent, "experience.storageError");
    assert.equal(denied.nodes.get("checkout-surface").hidden, true);
});

check("an offer without plans shows an explicit error instead of crashing checkout startup", async () => {
    const test = runtime({
        url: "https://emulator.example/checkout.html?offer=empty",
        catalogue: { empty: { offerId: "empty", displayName: "Empty", publisher: "Demo", plans: {} } }
    });
    await test.start();
    assert.equal(test.nodes.get("checkout-error").hidden, false);
    assert.equal(test.nodes.get("checkout-error").textContent, "journey.noPlans");
    assert.equal(test.nodes.get("checkout-loading").hidden, true);
    assert.equal(test.nodes.get("checkout-surface").hidden, true);
    assert.equal(test.nodes.get("checkout-complete").hidden, true);
    assert.equal(test.nodes.get("configure-account").getAttribute("href"), null);
});

module.exports = cases;

if (require.main === module) {
    (async () => {
        for (const [name, run] of cases) {
            await run();
            console.log("PASS " + name);
        }
        console.log(`${cases.length} checkout controller cases passed.`);
    })().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
