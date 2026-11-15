(function (root) {
    "use strict";
    const fixtures = {
        general: {
            plans: [
                { id: "basic", ja: "基本プラン", en: "Basic plan", price: 7500 },
                { id: "team", ja: "チームプラン", en: "Team plan", price: 12000 }
            ],
            terms: [1, 2, 3, 4, 5]
        },
        observation: {
            plans: [{ id: "observed", ja: "観察例のプラン", en: "Observed-example plan", price: 0 }],
            terms: [1, 2, 3, 4, 5]
        }
    };
    function initial() {
        return { preset: "general", route: "web", commercial: "public", activation: "manual",
            countryStep: false, planCount: "multiple", paymentFrequency: "year", renewDefault: true, country: "JP",
            plan: "basic", term: 1, renew: true, profile: "", profileName: "", profileMethod: "",
            subscriptionState: "notOrdered", productReadiness: "unconfirmed", confirmed: false };
    }
    function selectPreset(state, preset) {
        if (!Object.prototype.hasOwnProperty.call(fixtures, preset)) throw new Error("invalid preset");
        const defaults = initial();
        Object.assign(state, {
            preset: preset, route: defaults.route, commercial: defaults.commercial,
            activation: preset === "observation" ? "auto" : defaults.activation,
            planCount: preset === "observation" ? "one" : defaults.planCount,
            paymentFrequency: defaults.paymentFrequency, renewDefault: defaults.renewDefault
        });
    }
    function plans(state) {
        const all = fixtures[state.preset].plans;
        return state.planCount === "one" ? all.slice(0, 1) : all;
    }
    function quote(state) {
        const plan = plans(state).find(item => item.id === state.plan);
        if (!plan || !fixtures[state.preset].terms.includes(Number(state.term))) throw new Error("invalid plan or term");
        const total = plan.price * Number(state.term);
        const frequency = state.preset === "observation"
            ? (Number(state.term) === 1 ? "year" : "oneTime") : state.paymentFrequency;
        if (!["year", "oneTime"].includes(frequency)) throw new Error("invalid payment frequency");
        return { amount: frequency === "year" ? plan.price : total, total, frequency };
    }
    function complete(state) {
        if (!state.profile || state.confirmed || state.preset === "observation") return false;
        quote(state);
        state.confirmed = true;
        state.subscriptionState = state.activation === "auto" ? "Subscribed" : "PendingFulfillmentStart";
        return true;
    }
    function manualPurchase(state, id) {
        if (!state.confirmed || state.preset !== "general" || state.activation !== "manual" ||
            state.subscriptionState !== "PendingFulfillmentStart" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            throw new Error("invalid manual purchase");
        }
        quote(state);
        const party = { emailId: "demo.user@example.invalid", objectId: id, tenantId: id };
        return {
            id: id, name: "web-checkout-demo", offerId: "web-checkout-training", planId: state.plan,
            beneficiary: party, purchaser: { ...party }, autoRenew: state.renew,
            term: { termUnit: "P" + state.term + "Y" }, isTest: true
        };
    }
    const api = { fixtures, initial, selectPreset, plans, quote, complete, manualPurchase };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.WebCheckoutModel = api;
}(typeof window === "undefined" ? globalThis : window));
