(function () {
    "use strict";

    async function start() {
        document.title = t("experience.productName") + " — " + t("experience.demoNotice");
        const journey = window.PurchaseJourney;
        const experience = window.PurchaseExperience;
        const training = window.WebCheckoutModel;
        const form = document.getElementById("discovery-form");
        const offerSelect = document.getElementById("discovery-offer");
        const planSelect = document.getElementById("discovery-plan");
        const next = document.getElementById("discovery-continue");
        const error = document.getElementById("catalogue-error");
        const status = document.getElementById("catalogue-status");
        const requested = new URLSearchParams(window.location.search);
        let selectedScenario = journey.scenario(requested.get("scenario")) || "web-card";
        const requestedOffer = requested.get("offer");
        let webPlan = requestedOffer === training.trainingOfferId
            ? requested.get("plan") || ""
            : training.fixtures.general.plans[0].id;
        let azureSelection = requestedOffer && requestedOffer !== training.trainingOfferId
            ? { offerId: requestedOffer, planId: requested.get("plan") } : null;
        let catalogue = [];
        let catalogueStatus = "loading";
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

        function trainingOffer() {
            const language = journey.context().culture;
            const plans = {};
            training.fixtures.general.plans.forEach(function (plan) {
                plans[plan.id] = {
                    displayName: plan[language], isPricePerSeat: false,
                    planComponents: { recurrentBillingTerms: [{ price: plan.price, currency: "JPY", termUnit: "P1Y" }] }
                };
            });
            return {
                offerId: training.trainingOfferId, displayName: training.trainingProductName,
                publisher: t("experience.fictionalPublisher"), plans: plans
            };
        }

        function updateScenario() {
            selectedScenario = document.querySelector('input[name="scenario"]:checked').value;
            const web = selectedScenario === "web-card";
            document.body.classList.toggle("portal-entry", selectedScenario === "azure-portal");
            document.getElementById("listing-surface").textContent = t("journey." + selectedScenario + ".surface");
            next.textContent = t(selectedScenario === "azure-portal" ? "journey.subscribe" : "common.getItNow");
            document.getElementById("catalogue-offer-controls").hidden = web;
            document.getElementById("web-training-notice").hidden = !web;
            document.getElementById("catalogue-price-notice").hidden = web;
            document.getElementById("catalogue-error-link").hidden = web;
            error.hidden = true;
            status.hidden = web || catalogueStatus !== "loading";
            if (!web && catalogueStatus !== "ready") {
                document.getElementById("product-preview").hidden = true;
                next.disabled = true;
                journey.updateSelection(undefined, undefined, selectedScenario);
                if (catalogueStatus === "error") showError("journey.catalogueError");
                else if (catalogueStatus === "empty") showError("journey.noOffers");
                return;
            }
            offers = web ? [trainingOffer()] : catalogue;
            offerSelect.replaceChildren();
            offers.forEach(function (offer) {
                const option = document.createElement("option");
                option.value = offer.offerId;
                option.textContent = offer.displayName + " (" + offer.offerId + ")";
                offerSelect.appendChild(option);
            });
            offerSelect.disabled = web;
            let selection = null;
            if (!web && azureSelection) {
                try {
                    selection = journey.selection(offers, azureSelection.offerId, azureSelection.planId);
                } catch (cause) {
                    offerSelect.selectedIndex = -1;
                    document.getElementById("product-preview").hidden = true;
                    next.disabled = true;
                    journey.updateSelection(undefined, undefined, selectedScenario);
                    showError("journey.selectionError");
                    return;
                }
            }
            if (selection) offerSelect.value = selection.offer.offerId;
            updateOffer(web ? webPlan : selection && selection.planId);
            if (web && !Object.prototype.hasOwnProperty.call(offers[0].plans, webPlan)) showError("experience.webSelectionError");
        }

        function updatePlan() {
            const offer = offers.find(function (item) { return item.offerId === offerSelect.value; });
            const plan = offer && offer.plans[planSelect.value];
            const terms = experience.terms(plan);
            next.disabled = !plan || terms.length === 0;
            if (plan) {
                if (selectedScenario === "web-card") webPlan = planSelect.value;
                else azureSelection = { offerId: offerSelect.value, planId: planSelect.value };
            }
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
            journey.updateSelection(offerSelect.value,
                selectedScenario === "web-card" && !plan ? webPlan : planSelect.value, selectedScenario);
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
                    error.hidden = true;
                    updatePlan();
                    planSelect.focus();
                });
                card.append(title, price, choose);
                cards.appendChild(card);
            });
            if (planId !== undefined && planId !== null) planSelect.value = planId;
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
        planSelect.addEventListener("change", function () { error.hidden = true; updatePlan(); });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            if (next.disabled) return;
            if (selectedScenario === "web-card") {
                const url = journey.withContext("/web-checkout.html");
                url.searchParams.set("offer", training.trainingOfferId);
                url.searchParams.set("plan", planSelect.value);
                window.location.href = url.href;
            } else {
                window.location.href = journey.checkoutUrl(offerSelect.value, planSelect.value);
            }
        });

        try {
            catalogue = await journey.loadOffers();
            catalogueStatus = catalogue.length ? "ready" : "empty";
        } catch (error) {
            catalogueStatus = "error";
        }
        if (selectedScenario !== "web-card") updateScenario();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
}());
