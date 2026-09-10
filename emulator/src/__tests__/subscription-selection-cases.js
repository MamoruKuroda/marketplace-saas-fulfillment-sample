const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = name => fs.readFileSync(path.join(__dirname, "..", "client", name), "utf8");
const cases = [];
const check = (name, run) => cases.push([name, run]);
const first = "abcdef01-2345-6789-abcd-0123456789ab";
const second = "abcdef02-2345-6789-abcd-0123456789ab";

function node(id) {
    const attributes = new Map(id ? [["data-sid", id]] : []);
    const classes = new Set();
    return {
        hidden: false, textContent: "", scrolls: 0,
        getAttribute: key => attributes.get(key),
        setAttribute: (key, value) => attributes.set(key, value),
        removeAttribute(key) { attributes.delete(key); if (key === "href") delete this.href; },
        classList: { toggle: (key, value) => value ? classes.add(key) : classes.delete(key), contains: key => classes.has(key) },
        scrollIntoView() { this.scrolls++; }
    };
}

function runtime(search = "", language = "ja") {
    const rows = [node(first), node(second)];
    const heading = node();
    const ids = ["subscription-selection-status", "subscriptions-show-all", "partner-record", "partner-record-status", "subscriptions-error"];
    const nodes = new Map(ids.map(id => [id, node()]));
    const ready = [];
    const sandbox = {
        URL, URLSearchParams, console,
        location: new URL("https://emulator.example/subscriptions.html" + search),
        history: { replaceState: (_, __, target) => { sandbox.location = new URL(target, sandbox.location); } },
        document: {
            readyState: "loading", addEventListener() {},
            getElementById: id => nodes.get(id),
            querySelectorAll: selector => selector === "tr[data-sid]" ? rows :
                selector === "tr.publisher-heading" ? [heading] : []
        },
        i18nLang: () => language,
        t: key => key,
        formatI18n: (key, values) => key + ": " + values.id,
        $: value => { if (typeof value === "function") ready.push(value); return { on() {} }; }
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    for (const name of ["purchase-journey.js", "subscription-selection.js", "subscriptions.js"]) {
        vm.runInContext(source(name), context, { filename: name });
    }
    return { sandbox, context, rows, heading, nodes, ready };
}

check("subscription query accepts one exact existing ID, never a prefix, case-fold or duplicate", () => {
    const { sandbox } = runtime();
    const select = sandbox.EmulatorSubscriptions.select;
    assert.equal(select("?subscriptionId=" + first, [first, second]).kind, "selected");
    assert.equal(select("?subscriptionId=" + first.toUpperCase(), [first]).kind, "notFound");
    assert.equal(select("?subscriptionId=" + second, [first]).kind, "notFound");
    assert.equal(select("", [first]).kind, "all");
    for (const value of ["", "abcdef01", first + "&subscriptionId=" + first, "../admin", "%3Cscript%3E", first + "%20", "x%27%5D%2Ctr"]) {
        assert.equal(select("?subscriptionId=" + value, [first]).kind, "invalid", value);
    }
});

check("exact selection filters and highlights fetched rows, scrolls once, and links the partner saved record", () => {
    const test = runtime("?subscriptionId=" + second + "&scenario=web-azure");
    vm.runInContext('partnerLanding = "https://partner.example/landing?token=PRIVATE&other=discard#setup"', test.context);
    test.sandbox.updateSubscriptionSelection();
    assert.equal(test.rows[0].hidden, true);
    assert.equal(test.rows[1].hidden, false);
    assert.equal(test.rows[1].classList.contains("selected-subscription"), true);
    assert.equal(test.rows[1].getAttribute("aria-selected"), "true");
    assert.equal(test.rows[1].scrolls, 1);
    assert.equal(test.heading.hidden, true);
    assert.match(test.nodes.get("subscription-selection-status").textContent, new RegExp(second));
    const target = new URL(test.nodes.get("partner-record").href);
    assert.equal(target.origin, "https://partner.example");
    assert.equal(target.pathname, "/admin");
    assert.equal(target.searchParams.get("marketplaceSubscriptionId"), second);
    assert.equal(target.searchParams.get("scenario"), "web-azure");
    assert.equal(target.searchParams.get("culture"), "ja");
    assert.equal(target.searchParams.has("token"), false);
    assert.equal(target.searchParams.has("other"), false);
    assert.equal(target.hash, "");
    assert.equal(test.nodes.get("partner-record").hidden, false);
    test.sandbox.updateSubscriptionSelection();
    assert.equal(test.rows[1].scrolls, 1);
});

check("unknown, empty and invalid selection explicitly show all rows, without a made-up partner match", () => {
    for (const [id, key] of [[first.toUpperCase(), "subs.notFound"], ["", "subs.invalidSelection"], ["invalid", "subs.invalidSelection"]]) {
        const test = runtime("?subscriptionId=" + id);
        test.sandbox.updateSubscriptionSelection();
        assert.equal(test.rows.every(row => !row.hidden && !row.classList.contains("selected-subscription")), true);
        assert.equal(test.heading.hidden, false);
        assert.equal(test.nodes.get("partner-record").hidden, true);
        assert.equal(test.nodes.get("partner-record").href, undefined);
        assert.match(test.nodes.get("subscription-selection-status").textContent, new RegExp(key));
        assert.equal(test.nodes.get("subscriptions-show-all").hidden, false);
    }
});

check("a deleted selected row becomes not found and exposes the actual remaining list", () => {
    const test = runtime("?subscriptionId=" + second);
    test.sandbox.updateSubscriptionSelection();
    test.rows.pop();
    test.sandbox.updateSubscriptionSelection();
    assert.equal(test.rows[0].hidden, false);
    assert.equal(test.rows[0].classList.contains("selected-subscription"), false);
    assert.match(test.nodes.get("subscription-selection-status").textContent, /subs.notFound/);
    assert.equal(test.nodes.get("partner-record").hidden, true);
});

check("show all clears only selection and legacy highlight, preserving culture and scenario", () => {
    const test = runtime("?subscriptionId=" + first + "&scenario=azure-portal&culture=ja#" + first);
    const url = new URL(test.sandbox.EmulatorSubscriptions.showAllUrl());
    assert.equal(url.pathname, "/subscriptions.html");
    assert.equal(url.searchParams.has("subscriptionId"), false);
    assert.equal(url.searchParams.get("scenario"), "azure-portal");
    assert.equal(url.searchParams.get("culture"), "ja");
    assert.equal(url.hash, "");
});

check("language resolution and reload preserve the requested exact subscription", () => {
    const test = runtime("?subscriptionId=" + first + "&scenario=web-card&culture=ja");
    const stored = new Map();
    test.sandbox.localStorage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
    test.sandbox.navigator = { language: "en" };
    vm.runInContext(source("i18n.js"), test.context);
    assert.equal(test.sandbox.i18nLang(), "ja");
    assert.equal(test.sandbox.location.searchParams.get("subscriptionId"), first);
    assert.equal(test.sandbox.location.searchParams.get("scenario"), "web-card");
    assert.equal(test.sandbox.location.searchParams.has("culture"), false);
    const reload = runtime(test.sandbox.location.search, "en");
    reload.sandbox.updateSubscriptionSelection();
    assert.match(reload.nodes.get("subscription-selection-status").textContent, /subs.selected/);
});

check("partner links reject invalid origins and IDs and ignore untrusted partnerRecord navigation", () => {
    const test = runtime("?partnerRecord=https://untrusted.example&subscriptionId=" + first);
    for (const url of ["javascript:alert(1)", "ftp://partner.example", "https://user:password@partner.example", "/relative", ""]) {
        assert.throws(() => test.sandbox.EmulatorSubscriptions.partnerUrl(url, first));
    }
    assert.throws(() => test.sandbox.EmulatorSubscriptions.partnerUrl("https://partner.example", "../admin"));
    const url = new URL(test.sandbox.EmulatorSubscriptions.partnerUrl("https://partner.example/landing", first));
    assert.equal(url.origin, "https://partner.example");
    assert.equal(url.searchParams.has("partnerRecord"), false);
});

check("operation failures retain status and response text without changing webhook requests or asserting partner persistence", async () => {
    const test = runtime("?subscriptionId=" + second);
    let request;
    test.sandbox.doFetch = async (...args) => {
        request = args;
        return { ok: false, status: 409, text: async () => "Partner operation rejected" };
    };
    await test.sandbox.callWebhook("Change plan", first, "", { planId: "team" });
    assert.equal(request[1], `/api/webhook/subscription/${first}/`);
    assert.equal(request[2], '{"planId":"team"}');
    assert.equal(request[3], "PATCH");
    const error = test.nodes.get("subscriptions-error");
    assert.equal(error.hidden, false);
    assert.match(error.textContent, /409.*Partner operation rejected/);
    test.sandbox.doFetch = async () => { throw new Error("Network unavailable"); };
    await test.sandbox.callWebhook("Renew", first, "renew");
    assert.match(error.textContent, /Network unavailable/);
    assert.doesNotMatch(error.textContent, /synchroniz|saved successfully/i);
});

check("initial API errors are visible rather than masquerading as an empty saved-state list", async () => {
    const test = runtime("?subscriptionId=" + first);
    test.sandbox.callAPI = async () => ({ status: 503, result: "Saved state unavailable" });
    await test.ready[0]();
    assert.equal(test.nodes.get("subscriptions-error").hidden, false);
    assert.match(test.nodes.get("subscriptions-error").textContent, /503.*Saved state unavailable/);
    assert.doesNotMatch(test.nodes.get("subscription-selection-status").textContent, /notFound|allRecords/);
});

check("every page has one closed common Demo disclosure and no repeated visible disclaimer bars", () => {
    const test = runtime();
    vm.runInContext(source("i18n.js"), test.context);
    const { en, ja } = test.sandbox.I18N;
    for (const file of ["start.html", "checkout.html", "subscriptions.html", "index.html", "landing.html", "offers.html", "config.html"]) {
        const html = source(file);
        assert.equal((html.match(/class="demo-scope"/g) || []).length, 1, file);
        const scope = html.match(/<details class="demo-scope">([\s\S]*?)<\/details>/);
        assert.ok(scope, file);
        assert.match(scope[1], /<summary>Demo<\/summary>/);
        assert.match(scope[1], /scope.simulation/);
        assert.match(scope[1], /scope.roles/);
        assert.doesNotMatch(html, /class="(?:demo-badge|page-hint|simulation-note|boundary-badge)"/, file);
        assert.doesNotMatch(html, /data-i18n="(?:experience.demoNotice|boundary.roleNotice)"/, file);
        for (const [, key] of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) assert.ok(en[key] && ja[key], `${file}: ${key}`);
    }
    assert.match(en["scope.simulation"], /no real purchase or payment.*hosting may incur costs/);
    assert.match(ja["scope.simulation"], /購入・決済.*ホスティング費用/);
    assert.match(en["scope.roles"], /not authorization/);
    assert.match(ja["scope.roles"], /認可制御ではありません/);
    assert.equal(en["subs.partnerRecord"], "View partner saved record");
    assert.match(ja["subs.partnerRecord"], /パートナー企業/);
    const checkout = source("checkout.html");
    assert.equal((checkout.match(/data-i18n="scope.noPayment"/g) || []).length, 2, "One note per mutually exclusive confirmation stage");
    assert.match(checkout, /experience.noCardEntry/);
    assert.match(checkout, /<details class="simulation-details"><summary data-i18n="scope.behind">/);
    assert.doesNotMatch(checkout, /<details[^>]*\bopen\b/);
    assert.match(source("subscriptions.html"), /Source: emulator saved state/);
    assert.match(source("subscriptions.html"), /id="subscriptions-error"[^>]*role="alert"/);
});

module.exports = cases;
if (require.main === module) {
    (async () => {
        for (const [name, run] of cases) {
            await run();
            console.log("PASS " + name);
        }
        console.log(`${cases.length} subscription selection cases passed.`);
    })().catch(error => { console.error(error); process.exitCode = 1; });
}
