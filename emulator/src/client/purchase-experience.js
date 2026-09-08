(function (root) {
    "use strict";

    function channel(scenario) {
        return scenario === "web-azure" || scenario === "azure-portal" ? "azure" : "web";
    }

    function terms(plan) {
        const values = plan && plan.planComponents && plan.planComponents.recurrentBillingTerms;
        if (!Array.isArray(values)) return [];
        return values.filter(function (term) {
            return term && typeof term.price === "number" && Number.isFinite(term.price) &&
                term.price >= 0 && /^[A-Z]{3}$/.test(term.currency) && typeof term.termUnit === "string";
        });
    }

    // Display estimate only. Billing choices and synthetic payment/project details never enter the token.
    function quote(plan, termIndex, quantity) {
        const term = terms(plan)[termIndex];
        if (!term) throw new Error("experience.noPrice");
        const units = plan.isPricePerSeat ? Number(quantity) : 1;
        if (!Number.isSafeInteger(units) || units < 1) throw new Error("experience.quantityError");
        const total = term.price * units;
        if (!Number.isFinite(total)) throw new Error("experience.quantityError");
        return { unitPrice: term.price, total: total, currency: term.currency, termUnit: term.termUnit, units: units };
    }

    function price(value, currency, culture) {
        return new Intl.NumberFormat(culture === "ja" ? "ja-JP" : "en-US",
            { style: "currency", currency: currency }).format(value);
    }

    function productName(offer, translate) {
        return offer.builtIn ? translate("experience.productName") : offer.displayName;
    }

    function validate(draft, plan, scenario) {
        const errors = [];
        if (!draft.name || !draft.name.trim() || draft.name.length > 200) errors.push("subscriptionName");
        try { quote(plan, draft.termIndex, draft.quantity); }
        catch (error) { errors.push(error.message === "experience.quantityError" ? "quantity" : "billing-term"); }
        if (channel(scenario) === "web") {
            if (!["individual", "company"].includes(draft.billingProfile)) errors.push("billing-profile");
            if (!["corporate", "team"].includes(draft.paymentMethod)) errors.push("payment-method");
        } else {
            if (!["team", "sandbox"].includes(draft.azureSubscription)) errors.push("azure-subscription");
            if (!["applications", "evaluation"].includes(draft.resourceGroup)) errors.push("resource-group");
        }
        if (draft.accepted !== true) errors.push("accept-terms");
        return errors;
    }

    const api = { channel: channel, terms: terms, quote: quote, price: price, productName: productName, validate: validate };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.PurchaseExperience = api;
}(typeof window === "undefined" ? globalThis : window));
