(function () {
    "use strict";

    async function start() {
        document.title = t("experience.productName") + " — " + t("experience.demoNotice");
        const journey = window.PurchaseJourney;
        const experience = window.PurchaseExperience;
        const form = document.getElementById("discovery-form");
        const offerSelect = document.getElementById("discovery-offer");
        const planSelect = document.getElementById("discovery-plan");
        const next = document.getElementById("discovery-continue");
        const error = document.getElementById("catalogue-error");
        const status = document.getElementById("catalogue-status");
        const requested = new URLSearchParams(window.location.search);
        let selectedScenario = journey.scenario(requested.get("scenario")) || "web-card";
        let offers = [];
        const tabs = document.querySelectorAll(".product-tabs a");
        tabs.forEach(function (link) {
            link.addEventListener("click", function () {
                tabs.forEach(item => item.removeAttribute("aria-current"));
                link.setAttribute("aria-current", "location");
            });
        });

        function showError(key) {
            error.hidden = false;
            document.getElementById("catalogue-error-message").textContent = t(key);
        }

        function updateScenario() {
            selectedScenario = document.querySelector('input[name="scenario"]:checked').value;
            document.body.classList.toggle("portal-entry", selectedScenario === "azure-portal");
            document.getElementById("listing-surface").textContent = t("journey." + selectedScenario + ".surface");
            next.textContent = t(selectedScenario === "azure-portal" ? "journey.subscribe" : "common.getItNow");
            journey.updateSelection(offerSelect.value || undefined, planSelect.value || undefined, selectedScenario);
        }

        function updatePlan() {
            const offer = offers.find(function (item) { return item.offerId === offerSelect.value; });
            const plan = offer && offer.plans[planSelect.value];
            const terms = experience.terms(plan);
            next.disabled = !plan || terms.length === 0;
            document.getElementById("product-price").textContent = terms.length
                ? experience.price(terms[0].price, terms[0].currency, journey.context().culture, offer.builtIn)
                : t("experience.noPrice");
            document.getElementById("product-period").textContent = terms.length
                ? termLabel(terms[0].termUnit) + (plan.isPricePerSeat ? " · " + t("experience.perUser") : "")
                : "";
            document.querySelectorAll(".plan-card").forEach(function (card) {
                const selected = card.dataset.plan === planSelect.value;
                card.classList.toggle("selected", selected);
                card.querySelector("button").setAttribute("aria-pressed", String(selected));
            });
            journey.updateSelection(offerSelect.value, planSelect.value, selectedScenario);
        }

        function termLabel(unit) {
            return unit === "P1M" ? t("experience.monthly") : unit === "P1Y" ? t("experience.annual") : unit;
        }

        function updateOffer(planId) {
            const offer = offers.find(function (item) { return item.offerId === offerSelect.value; });
            planSelect.replaceChildren();
            const cards = document.getElementById("plan-cards");
            cards.replaceChildren();
            Object.entries(offer.plans).forEach(function (entry) {
                const option = document.createElement("option");
                option.value = entry[0];
                option.textContent = entry[1].displayName + " (" + entry[0] + ")";
                planSelect.appendChild(option);
                const card = document.createElement("article");
                card.className = "plan-card";
                card.dataset.plan = entry[0];
                const title = document.createElement("strong");
                title.textContent = entry[1].displayName;
                const price = document.createElement("p");
                const term = experience.terms(entry[1])[0];
                price.textContent = term
                    ? experience.price(term.price, term.currency, journey.context().culture, offer.builtIn) + " · " + termLabel(term.termUnit)
                    : t("experience.noPrice");
                const choose = document.createElement("button");
                choose.type = "button";
                choose.className = "secondary";
                choose.textContent = t("experience.selectPlan") + " — " + entry[1].displayName;
                choose.addEventListener("click", function () {
                    planSelect.value = entry[0];
                    updatePlan();
                    planSelect.focus();
                });
                card.append(title, price, choose);
                cards.appendChild(card);
            });
            if (planId) planSelect.value = planId;
            planSelect.disabled = planSelect.options.length === 0;
            document.getElementById("product-preview").hidden = false;
            document.getElementById("product-name").textContent = experience.productName(offer, t);
            document.getElementById("product-publisher").textContent = offer.publisher;
            error.hidden = true;
            if (planSelect.disabled) showError("journey.noPlans");
            updatePlan();
        }

        document.querySelector('input[name="scenario"][value="' + selectedScenario + '"]').checked = true;
        document.getElementById("scenario-warning").hidden =
            !requested.has("scenario") || !!journey.scenario(requested.get("scenario"));
        document.querySelectorAll('input[name="scenario"]').forEach(function (radio) {
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
