(function () {
    "use strict";

    async function start() {
        document.title = t("journey.startTitle") + " — Marketplace API Emulator";
        const journey = window.PurchaseJourney;
        const form = document.getElementById("discovery-form");
        const offerSelect = document.getElementById("discovery-offer");
        const planSelect = document.getElementById("discovery-plan");
        const next = document.getElementById("discovery-continue");
        const error = document.getElementById("catalogue-error");
        const status = document.getElementById("catalogue-status");
        const requested = new URLSearchParams(window.location.search);
        let selectedScenario = journey.scenario(requested.get("scenario")) || "web-card";
        let offers = [];

        function showError(key) {
            error.hidden = false;
            document.getElementById("catalogue-error-message").textContent = t(key);
        }

        function updateScenario() {
            selectedScenario = form.querySelector('input[name="scenario"]:checked').value;
            document.getElementById("listing-surface").textContent = t("journey." + selectedScenario + ".surface");
            next.textContent = t(selectedScenario === "azure-portal" ? "journey.subscribe" : "common.getItNow");
            journey.updateSelection(offerSelect.value || undefined, planSelect.value || undefined, selectedScenario);
        }

        function updatePlan() {
            next.disabled = !planSelect.value;
            journey.updateSelection(offerSelect.value, planSelect.value, selectedScenario);
        }

        function updateOffer(planId) {
            const offer = offers.find(function (item) { return item.offerId === offerSelect.value; });
            planSelect.replaceChildren();
            Object.entries(offer.plans).forEach(function (entry) {
                const option = document.createElement("option");
                option.value = entry[0];
                option.textContent = entry[1].displayName + " (" + entry[0] + ")";
                planSelect.appendChild(option);
            });
            if (planId) planSelect.value = planId;
            planSelect.disabled = planSelect.options.length === 0;
            document.getElementById("product-preview").hidden = false;
            document.getElementById("product-name").textContent = offer.displayName;
            document.getElementById("product-publisher").textContent = offer.publisher;
            error.hidden = true;
            if (planSelect.disabled) showError("journey.noPlans");
            updatePlan();
        }

        form.querySelector('input[value="' + selectedScenario + '"]').checked = true;
        document.getElementById("scenario-warning").hidden =
            !requested.has("scenario") || !!journey.scenario(requested.get("scenario"));
        form.querySelectorAll('input[name="scenario"]').forEach(function (radio) {
            radio.addEventListener("change", function () {
                document.getElementById("scenario-warning").hidden = true;
                updateScenario();
            });
        });
        updateScenario();
        offerSelect.addEventListener("change", function () { updateOffer(); });
        planSelect.addEventListener("change", updatePlan);
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            if (next.disabled) return;
            window.location.href = journey.checkoutUrl(offerSelect.value, planSelect.value);
        });

        try {
            offers = await journey.loadOffers();
        } catch (error) {
            status.hidden = true;
            showError("journey.catalogueError");
            return;
        }
        status.hidden = true;
        if (!offers.length) {
            showError("journey.noOffers");
            return;
        }
        offers.forEach(function (offer) {
            const option = document.createElement("option");
            option.value = offer.offerId;
            option.textContent = offer.displayName + " (" + offer.offerId + ")";
            offerSelect.appendChild(option);
        });
        offerSelect.disabled = false;
        let selection;
        try {
            selection = journey.selection(offers, requested.get("offer"), requested.get("plan"));
        } catch (error) {
            offerSelect.selectedIndex = -1;
            showError("journey.selectionError");
            return;
        }
        if (selection) offerSelect.value = selection.offer.offerId;
        updateOffer(selection && selection.planId);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
}());
