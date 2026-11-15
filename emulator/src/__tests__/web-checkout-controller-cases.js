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

class Element {
    constructor(tag) {
        this.tag = tag;
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.dataset = {};
        this.hidden = false;
        this.disabled = false;
        this.checked = false;
        this.value = "";
        this.textContent = "";
    }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.children.push(node); return node; }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    set href(value) { this.setAttribute("href", value); }
    get href() { return this.getAttribute("href"); }
    focus() {}
    querySelector(selector) {
        if (selector === "h2") return new Element("h2");
        if (selector === "input:checked") {
            return this.children.flatMap(child => child.children || []).find(child => child.checked);
        }
        return null;
    }
}

function runtime(options = {}) {
    const nodes = new Map();
    for (const [, tag, id] of source("web-checkout.html").matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"/g)) {
        nodes.set(id, new Element(tag));
    }
    const byId = id => {
        assert.ok(nodes.has(id), `Missing #${id}`);
        return nodes.get(id);
    };
    const readiness = new Element("dd");
    const requests = [];
    const document = {
        readyState: "complete",
        documentElement: {},
        querySelectorAll: () => [],
        querySelector: selector => selector === "#complete dd[data-text=notConfirmed]" ? readiness : null,
        getElementById: byId,
        createElement: tag => new Element(tag),
        createTextNode: text => ({ textContent: text })
    };
    const storage = new Map();
    const sandbox = {
        URL, URLSearchParams, TextEncoder, Uint8Array, document,
        location: new URL(options.url || "http://localhost:3978/web-checkout.html?culture=ja"),
        navigator: { language: "ja" },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        crypto: { getRandomValues: bytes => webcrypto.getRandomValues(bytes) },
        btoa: text => Buffer.from(text, "binary").toString("base64"),
        i18nLang: () => "ja",
        fetch: async url => {
            requests.push(url);
            return options.fetch ? options.fetch(url) : {
                ok: true, json: async () => ({ landingPageUrl: "https://publisher.example/setup?existing=yes#details" })
            };
        }
    };
    sandbox.window = sandbox;
    sandbox.history = { replaceState: () => {} };
    const context = vm.createContext(sandbox);
    for (const name of ["purchase-journey.js", "web-checkout-model.js", "web-checkout.js"]) {
        vm.runInContext(source(name), context, { filename: name });
    }
    return {
        nodes, requests, byId,
        click: id => byId(id).listeners.click(),
        change: (id, value) => { byId(id).value = value; byId(id).listeners.change(); },
        flush: () => new Promise(resolve => setImmediate(resolve)),
        payment() {
            byId("next").listeners.click();
            byId("next").listeners.click();
            byId("profile").value = "sample";
            byId("profile").listeners.change();
        }
    };
}

check("manual checkout passes its frozen mock purchase to the configured landing page", async () => {
    const test = runtime();
    assert.equal(test.byId("activation").value, "manual");
    test.byId("plans").children[1].children[0].listeners.change();
    test.byId("terms").children[2].children[0].listeners.change();
    test.byId("renew").checked = false;
    test.byId("renew").listeners.change();
    test.payment();
    assert.deepEqual(test.requests, []);
    test.click("order");
    assert.equal(test.byId("subscription-state").textContent, "PendingFulfillmentStart");
    assert.equal(test.byId("manual-handoff").hidden, false);
    await test.flush();
    assert.deepEqual(test.requests, ["/api/util/config"]);
    assert.equal(test.byId("configure-account").hidden, false);
    const url = new URL(test.byId("configure-account").href);
    const purchase = JSON.parse(Buffer.from(url.searchParams.get("token"), "base64").toString("utf8"));
    assert.equal(url.origin + url.pathname, "https://publisher.example/setup");
    assert.equal(url.searchParams.get("existing"), "yes");
    assert.equal(url.hash, "#details");
    assert.equal(url.searchParams.get("culture"), "ja");
    assert.equal(url.searchParams.get("scenario"), "web-card");
    assert.equal(purchase.id, test.byId("mock-order-id").textContent);
    assert.equal(purchase.offerId, "web-checkout-training");
    assert.equal(purchase.planId, "team");
    assert.deepEqual(purchase.term, { termUnit: "P3Y" });
    assert.equal(purchase.autoRenew, false);
    assert.equal(purchase.isTest, true);
    assert.equal(Object.hasOwn(purchase, "price"), false);
    assert.equal(Object.hasOwn(purchase, "profile"), false);
    const token = url.searchParams.get("token");
    test.click("lang-en");
    const english = new URL(test.byId("configure-account").href);
    assert.equal(english.searchParams.get("culture"), "en");
    assert.equal(english.searchParams.get("token"), token);
});

check("observation stays read-only and returning to general restores manual activation", () => {
    const test = runtime();
    test.change("preset", "observation");
    assert.equal(test.byId("activation").value, "auto");
    assert.equal(test.byId("activation").disabled, true);
    test.payment();
    assert.equal(test.byId("order").disabled, true);
    test.change("preset", "general");
    assert.equal(test.byId("activation").value, "manual");
    assert.equal(test.byId("activation").disabled, false);
});

check("automatic activation is an in-page simulation and does not request a handoff", async () => {
    const test = runtime();
    test.change("activation", "auto");
    test.payment();
    test.click("order");
    await test.flush();
    assert.equal(test.byId("subscription-state").textContent, "Subscribed");
    assert.equal(test.byId("manual-handoff").hidden, true);
    assert.deepEqual(test.requests, []);
});

check("unavailable configuration shows an error and retry does not invent a destination", async () => {
    let calls = 0;
    const test = runtime({ fetch: async () => ++calls === 1
        ? { ok: false }
        : { ok: true, json: async () => ({ landingPageUrl: "https://publisher.example/" }) } });
    test.payment();
    test.click("order");
    await test.flush();
    assert.equal(test.byId("configure-account").hidden, true);
    assert.equal(test.byId("configure-account").href, null);
    assert.equal(test.byId("retry-config").hidden, false);
    assert.match(test.byId("handoff-status").textContent, /設定先を読み込めません/);
    test.click("retry-config");
    await test.flush();
    assert.equal(test.byId("configure-account").hidden, false);
    assert.equal(test.byId("retry-config").hidden, true);
});

check("a remote demo rejects a loopback landing destination", async () => {
    const test = runtime({
        url: "https://demo.example/web-checkout.html",
        fetch: async () => ({ ok: true, json: async () => ({ landingPageUrl: "http://localhost:5134/" }) })
    });
    test.payment();
    test.click("order");
    await test.flush();
    assert.equal(test.byId("configure-account").hidden, true);
    assert.equal(test.byId("retry-config").hidden, false);
});

check("a stale configuration response cannot resurrect a reset purchase", async () => {
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const test = runtime({ fetch: () => pending });
    test.payment();
    test.click("order");
    test.click("reset");
    finish({ ok: true, json: async () => ({ landingPageUrl: "https://publisher.example/" }) });
    await test.flush();
    assert.equal(test.byId("manual-handoff").hidden, true);
    assert.equal(test.byId("configure-account").hidden, true);
    assert.equal(test.byId("configure-account").href, null);
});

module.exports = cases;
