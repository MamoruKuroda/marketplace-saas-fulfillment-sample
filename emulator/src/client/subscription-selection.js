(function () {
    "use strict";

    function validId(value) {
        return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    function select(search, ids) {
        const values = new URLSearchParams(search).getAll("subscriptionId");
        if (!values.length) return { kind: "all" };
        if (values.length !== 1 || !validId(values[0])) return { kind: "invalid" };
        const id = values[0];
        return { kind: ids.includes(id) ? "selected" : "notFound", id: id };
    }

    function partnerUrl(landingPageUrl, id) {
        if (!validId(id)) throw new Error("Invalid subscription ID");
        const base = new URL(landingPageUrl);
        if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error("Invalid partner URL");
        const target = new URL("/admin", base.origin);
        target.searchParams.set("marketplaceSubscriptionId", id);
        return window.PurchaseJourney.withContext(target).href;
    }

    function showAllUrl() {
        const url = window.PurchaseJourney.withContext(window.location.href);
        url.searchParams.delete("subscriptionId");
        url.hash = "";
        return url.href;
    }

    window.EmulatorSubscriptions = { validId: validId, select: select, partnerUrl: partnerUrl, showAllUrl: showAllUrl };
}());
