(function () {
    "use strict";

    const scenarios = ["web-card", "web-azure", "azure-portal"];

    function scenario(value) {
        return scenarios.includes(value) ? value : null;
    }

    function newId() {
        // getRandomValues also works on HTTP emulator hosts, unlike randomUUID.
        const bytes = window.crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
        return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
            hex.slice(16, 20) + "-" + hex.slice(20);
    }

    function context() {
        return {
            scenario: scenario(new URLSearchParams(window.location.search).get("scenario")),
            culture: window.i18nLang() === "ja" ? "ja" : "en"
        };
    }

    // Context is navigation metadata, never part of the purchase token or API payload.
    function withContext(target) {
        const url = new URL(target, window.location.href);
        const current = context();
        url.searchParams.set("culture", current.culture);
        if (current.scenario) url.searchParams.set("scenario", current.scenario);
        else url.searchParams.delete("scenario");
        return url;
    }

    function checkoutUrl(offerId, planId) {
        const url = withContext("/checkout.html");
        url.searchParams.set("offer", offerId);
        url.searchParams.set("plan", planId);
        return url.href;
    }

    function landingUrl(target, token) {
        const url = withContext(target);
        url.searchParams.set("token", token);
        return url.href;
    }

    function purchaseToken(purchase) {
        const sub = {
            id: purchase.id,
            name: purchase.name,
            offerId: purchase.offerId,
            planId: purchase.planId,
            beneficiary: purchase.beneficiary,
            purchaser: purchase.purchaser,
            quantity: purchase.quantity,
            autoRenew: false,
            isTest: false,
            isFreeTrial: false
        };
        const json = JSON.stringify(sub, null, 2);
        let binary = "";
        for (const byte of new TextEncoder().encode(json)) binary += String.fromCharCode(byte);
        return { json: json, base64: window.btoa(binary) };
    }

    function updateSelection(offerId, planId, selectedScenario) {
        const url = new URL(window.location.href);
        if (offerId !== undefined) {
            if (offerId) url.searchParams.set("offer", offerId);
            else url.searchParams.delete("offer");
        }
        if (planId !== undefined) {
            if (planId) url.searchParams.set("plan", planId);
            else url.searchParams.delete("plan");
        }
        if (scenario(selectedScenario)) url.searchParams.set("scenario", selectedScenario);
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        updateLinks();
    }

    function updateLinks() {
        document.querySelectorAll("nav a[href], .demo-map a[href], a[data-journey-link]").forEach(function (a) {
            const href = a.getAttribute("href");
            if (!href || href.startsWith("#") || a.hasAttribute("data-lang")) return;
            const url = new URL(href, window.location.href);
            if (url.origin === window.location.origin || a.closest(".demo-map")) {
                a.href = withContext(url).href;
            }
        });
    }

    async function loadOffers() {
        const response = await fetch("/api/util/offers");
        if (!response.ok) throw new Error("journey.catalogueError");
        const catalogue = await response.json();
        if (!catalogue || typeof catalogue !== "object" || Array.isArray(catalogue)) {
            throw new Error("journey.catalogueError");
        }
        const offers = Object.values(catalogue);
        if (offers.some(function (offer) {
            return !offer || typeof offer.offerId !== "string" || !offer.offerId ||
                typeof offer.displayName !== "string" || typeof offer.publisher !== "string" ||
                !offer.plans || typeof offer.plans !== "object" || Array.isArray(offer.plans) ||
                Object.values(offer.plans).some(function (plan) {
                    return !plan || typeof plan.displayName !== "string";
                });
        })) throw new Error("journey.catalogueError");
        return offers;
    }

    function selection(offers, offerId, planId) {
        if (!offerId && !planId) return null;
        const offer = offers.find(function (item) { return item.offerId === offerId; });
        if (!offer || (planId && !Object.prototype.hasOwnProperty.call(offer.plans, planId))) {
            throw new Error("journey.selectionError");
        }
        return { offer: offer, planId: planId || Object.keys(offer.plans)[0] };
    }

    window.PurchaseJourney = {
        scenario: scenario,
        newId: newId,
        context: context,
        withContext: withContext,
        checkoutUrl: checkoutUrl,
        landingUrl: landingUrl,
        purchaseToken: purchaseToken,
        updateSelection: updateSelection,
        updateLinks: updateLinks,
        loadOffers: loadOffers,
        selection: selection
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateLinks);
    else updateLinks();
}());
