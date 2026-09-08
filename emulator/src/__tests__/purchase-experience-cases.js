const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { TextEncoder } = require("node:util");
const experience = require("../client/purchase-experience");

const cases = [];
const check = (name, run) => cases.push([name, run]);
const seatPlan = {
    displayName: "Catalogue team",
    isPricePerSeat: true,
    planComponents: {
        recurrentBillingTerms: [
            { price: 12.5, currency: "GBP", termUnit: "P1M" },
            { price: 119, currency: "EUR", termUnit: "P1Y" }
        ]
    }
};
const flatPlan = { ...seatPlan, isPricePerSeat: false };
const validDraft = {
    name: "研究開発チーム", termIndex: 1, quantity: 4,
    billingProfile: "company", paymentMethod: "team",
    azureSubscription: "sandbox", resourceGroup: "evaluation", accepted: true
};

check("buying channels distinguish Web card from both Azure purchase routes", () => {
    assert.equal(experience.channel("web-card"), "web");
    assert.equal(experience.channel("web-azure"), "azure");
    assert.equal(experience.channel("azure-portal"), "azure");
});

check("display quotes take the selected catalogue currency, price, period and seat quantity", () => {
    assert.deepEqual(experience.quote(seatPlan, 0, 3), {
        unitPrice: 12.5, total: 37.5, currency: "GBP", termUnit: "P1M", units: 3
    });
    assert.deepEqual(experience.quote(seatPlan, 1, 4), {
        unitPrice: 119, total: 476, currency: "EUR", termUnit: "P1Y", units: 4
    });
    const changedCatalogue = {
        ...seatPlan,
        planComponents: { recurrentBillingTerms: [{ price: 731, currency: "JPY", termUnit: "P3M" }] }
    };
    assert.deepEqual(experience.quote(changedCatalogue, 0, 2), {
        unitPrice: 731, total: 1462, currency: "JPY", termUnit: "P3M", units: 2
    });
    assert.deepEqual(experience.quote(flatPlan, 1, 99), {
        unitPrice: 119, total: 119, currency: "EUR", termUnit: "P1Y", units: 1
    });
});

check("unconfigured and malformed prices never become invented defaults", () => {
    for (const plan of [undefined, {}, { planComponents: {} },
        { planComponents: { recurrentBillingTerms: {} } }]) {
        assert.equal(experience.terms(plan).length, 0);
        assert.throws(() => experience.quote(plan, 0, 1), /experience.noPrice/);
    }
    const good = { price: 0, currency: "USD", termUnit: "P1M" };
    const malformed = [
        null, {}, { ...good, price: "50" }, { ...good, price: -1 },
        { ...good, price: Infinity }, { ...good, price: NaN },
        { ...good, currency: "usd" }, { ...good, currency: "" },
        { ...good, currency: "USD<script>" }, { ...good, termUnit: null }
    ];
    const plan = { planComponents: { recurrentBillingTerms: [...malformed, good] } };
    assert.equal(experience.terms(plan).length, 1);
    assert.equal(experience.terms(plan)[0], good);
    assert.equal(experience.quote(plan, 0, 1).total, 0);
    assert.equal(plan.planComponents.recurrentBillingTerms.length, malformed.length + 1);
    for (const index of [-1, 1, 0.5, NaN]) {
        assert.throws(() => experience.quote(plan, index, 1), /experience.noPrice/);
    }
});

check("seat quantities must be positive safe integers and totals must be finite", () => {
    for (const quantity of [0, -1, 1.5, Infinity, NaN, "", "no", Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => experience.quote(seatPlan, 0, quantity), /experience.quantityError/);
        assert.ok(experience.validate({ ...validDraft, quantity }, seatPlan, "web-card").includes("quantity"));
    }
    const overflowing = {
        ...seatPlan,
        planComponents: { recurrentBillingTerms: [{ price: Number.MAX_VALUE, currency: "GBP", termUnit: "P1M" }] }
    };
    assert.throws(() => experience.quote(overflowing, 0, 2), /experience.quantityError/);
});

check("Web checkout validates synthetic billing profile and card, not Azure project fields", () => {
    assert.deepEqual(experience.validate(validDraft, seatPlan, "web-card"), []);
    const invalid = experience.validate({
        ...validDraft, billingProfile: "unknown", paymentMethod: "4111111111111111",
        azureSubscription: "", resourceGroup: ""
    }, seatPlan, "web-card");
    assert.deepEqual(invalid, ["billing-profile", "payment-method"]);
    for (const billingProfile of ["individual", "company"]) {
        for (const paymentMethod of ["corporate", "team"]) {
            assert.deepEqual(experience.validate({
                ...validDraft, billingProfile, paymentMethod, azureSubscription: "", resourceGroup: ""
            }, seatPlan, "web-card"), []);
        }
    }
});

for (const scenario of ["web-azure", "azure-portal"]) {
    check(`${scenario}: only known purchasable synthetic subscriptions and resource groups validate`, () => {
        for (const azureSubscription of ["team", "sandbox"]) {
            for (const resourceGroup of ["applications", "evaluation"]) {
                assert.deepEqual(experience.validate({
                    ...validDraft, azureSubscription, resourceGroup, billingProfile: "", paymentMethod: ""
                }, seatPlan, scenario), []);
            }
        }
        for (const azureSubscription of ["", "readonly", "unknown", "__proto__"]) {
            assert.deepEqual(experience.validate({ ...validDraft, azureSubscription }, seatPlan, scenario),
                ["azure-subscription"]);
        }
        assert.deepEqual(experience.validate({ ...validDraft, resourceGroup: "production" }, seatPlan, scenario),
            ["resource-group"]);
    });
}

check("every route requires a subscription name, configured term and explicit demo consent", () => {
    for (const scenario of ["web-card", "web-azure", "azure-portal"]) {
        for (const name of ["", " \t ", "x".repeat(201)]) {
            assert.ok(experience.validate({ ...validDraft, name }, seatPlan, scenario).includes("subscriptionName"));
        }
        assert.deepEqual(experience.validate({ ...validDraft, name: "x".repeat(200) }, seatPlan, scenario), []);
        for (const accepted of [false, undefined, "true", 1]) {
            assert.ok(experience.validate({ ...validDraft, accepted }, seatPlan, scenario).includes("accept-terms"));
        }
        assert.ok(experience.validate({ ...validDraft, termIndex: 2 }, seatPlan, scenario).includes("billing-term"));
        assert.ok(experience.validate(validDraft, {}, scenario).includes("billing-term"));
    }
});

check("currency rendering preserves actual currency and localizes without changing the quote", () => {
    const quote = experience.quote(seatPlan, 0, 2);
    assert.equal(experience.price(quote.total, quote.currency, "en"), "£25.00");
    assert.equal(experience.price(quote.total, quote.currency, "ja"), "£25.00");
    assert.equal(experience.price(731, "JPY", "en"), "¥731");
    assert.equal(experience.price(731, "JPY", "ja"), "￥731");
    assert.equal(quote.currency, "GBP");
    assert.equal(quote.total, 25);
});

check("built-in USD samples use the approved fixed JPY and USD display prices only", () => {
    const plan = {
        isPricePerSeat: true,
        planComponents: { recurrentBillingTerms: [{ price: 50, currency: "USD", termUnit: "P1M" }] }
    };
    const quote = experience.quote(plan, 0, 3);
    assert.equal(experience.price(50, "USD", "ja", true), "￥7,500");
    assert.equal(experience.price(50, "USD", "en", true), "US$50.00");
    assert.equal(experience.price(quote.total, quote.currency, "ja", true), "￥22,500");
    assert.equal(experience.price(quote.total, quote.currency, "en", true), "US$150.00");
    assert.equal(experience.price(0, "USD", "ja", true), "￥0");
    assert.equal(experience.price(0, "USD", "en", true), "US$0.00");
    assert.equal(quote.currency, "USD");
    assert.equal(quote.total, 150);
    assert.equal(experience.price(50, "USD", "ja", false), "$50.00");
    assert.equal(experience.price(50, "GBP", "ja", true), "£50.00");
});

check("fictional product alias applies only to built-in catalogue entries", () => {
    const translate = key => key === "experience.productName" ? "Demo workspace" : "unexpected";
    assert.equal(experience.productName({ builtIn: true, displayName: "Internal sample" }, translate), "Demo workspace");
    assert.equal(experience.productName({ builtIn: false, displayName: "Custom catalogue offer" }, translate),
        "Custom catalogue offer");
});

function journeyRuntime(crypto) {
    const sandbox = {
        URL, URLSearchParams, TextEncoder, Uint8Array, crypto,
        document: { readyState: "loading", addEventListener() {} },
        location: new URL("https://emulator.example/checkout.html?scenario=web-azure"),
        i18nLang: () => "ja",
        btoa: text => Buffer.from(text, "binary").toString("base64")
    };
    sandbox.window = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "client", "purchase-journey.js"), "utf8"), sandbox);
    return sandbox.PurchaseJourney;
}

check("newId produces UUIDv4 using getRandomValues when randomUUID is unavailable", () => {
    let calls = 0;
    const crypto = {
        getRandomValues(bytes) {
            calls++;
            assert.ok(bytes instanceof Uint8Array);
            assert.equal(bytes.length, 16);
            bytes.set(Array.from({ length: 16 }, (_, index) => index));
            return bytes;
        }
    };
    assert.equal(crypto.randomUUID, undefined);
    assert.equal(journeyRuntime(crypto).newId(), "00010203-0405-4607-8809-0a0b0c0d0e0f");
    assert.equal(calls, 1);
});

check("shared token helper preserves the complete legacy ASCII JSON layout and excludes checkout metadata", () => {
    const journey = journeyRuntime();
    const purchase = {
        id: "demo-order-id", name: "Workspace", offerId: "offer-one", planId: "team",
        beneficiary: { emailId: "buyer@example.test", objectId: "buyer-oid", tenantId: "buyer-tid" },
        purchaser: { emailId: "buyer@example.test", objectId: "buyer-oid", tenantId: "buyer-tid" },
        quantity: 4, autoRenew: false, isTest: false, isFreeTrial: false
    };
    const json = JSON.stringify(purchase, null, 2);
    for (const scenario of ["web-card", "web-azure", "azure-portal"]) {
        const result = journey.purchaseToken({
            ...purchase, scenario, culture: "ja", termIndex: 1, total: 476, currency: "EUR",
            billingProfile: "company", paymentMethod: "team", azureSubscription: "sandbox",
            resourceGroup: "evaluation", accepted: true, autoRenew: true, isTest: true, isFreeTrial: true
        });
        assert.equal(result.json, json);
        assert.equal(result.base64, Buffer.from(json, "ascii").toString("base64"));
        const decoded = JSON.parse(Buffer.from(result.base64, "base64").toString("utf8"));
        assert.deepEqual(decoded, purchase);
    }
});

check("Unicode names survive UTF-8 token encoding and exact URL handoff across native VM realms", () => {
    const journey = journeyRuntime();
    const name = "研究開発チーム 🚀 café";
    const purchase = {
        id: "same-order", name, offerId: "offer", planId: "team", quantity: 2,
        beneficiary: { emailId: "buyer@example.test" }, purchaser: { emailId: "buyer@example.test" }
    };
    const result = journey.purchaseToken(purchase);
    assert.equal(JSON.parse(Buffer.from(result.base64, "base64").toString("utf8")).name, name);
    assert.equal(Buffer.from(result.base64, "base64").toString("utf8"), result.json);
    const target = new URL(journey.landingUrl("https://publisher.example/?token=old&keep=yes#activate", result.base64));
    assert.equal(target.searchParams.getAll("token").length, 1);
    assert.equal(target.searchParams.get("token"), result.base64);
    assert.equal(target.searchParams.get("scenario"), "web-azure");
    assert.equal(target.searchParams.get("culture"), "ja");
    assert.equal(target.searchParams.get("keep"), "yes");
    assert.equal(target.hash, "#activate");
});

module.exports = cases;

if (require.main === module) {
    (async () => {
        for (const [name, run] of cases) {
            await run();
            console.log("PASS " + name);
        }
        console.log(`${cases.length} purchase experience cases passed.`);
    })().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
