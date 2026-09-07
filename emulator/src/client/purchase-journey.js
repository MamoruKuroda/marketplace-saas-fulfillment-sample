(function () {
    "use strict";

    const scenarios = ["web-card", "web-azure", "azure-portal"];

    function scenario(value) {
        return scenarios.includes(value) ? value : null;
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
        const url = withContext("/");
        url.searchParams.set("offer", offerId);
        url.searchParams.set("plan", planId);
        return url.href;
    }

    function landingUrl(target, token) {
        const url = withContext(target);
        url.searchParams.set("token", token);
        return url.href;
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
        context: context,
        withContext: withContext,
        checkoutUrl: checkoutUrl,
        landingUrl: landingUrl,
        updateSelection: updateSelection,
        loadOffers: loadOffers,
        selection: selection
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateLinks);
    else updateLinks();
}());
