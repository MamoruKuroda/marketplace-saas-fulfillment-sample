(function () {
    "use strict";

    async function start() {
        const journey = window.PurchaseJourney;
        const experience = window.PurchaseExperience;
        const query = new URLSearchParams(location.search);
        const scenario = journey.scenario(query.get("scenario")) || "web-card";
        const azure = experience.channel(scenario) === "azure";
        const byId = id => document.getElementById(id);
        const form = byId("checkout-form");
        const errorBox = byId("checkout-error");
        let stage;
        let offer;
        let config;
        let draft;
        let restored = false;
        const requestedDraft = query.get("draft");
        const draftId = /^[0-9a-f-]{36}$/i.test(requestedDraft || "") ? requestedDraft : journey.newId();
        const storageKey = "marketplace-purchase-demo:" + draftId;
        const stageNames = ["details", "review", "complete", "redirect"];

        function showError(key) {
            errorBox.textContent = t(key);
            errorBox.hidden = false;
        }

        function persist() {
            try {
                sessionStorage.setItem(storageKey, JSON.stringify(draft));
                return true;
            } catch (error) {
                showError("experience.storageError");
                return false;
            }
        }

        function plan() { return offer.plans[draft.planId]; }
        function termLabel(unit) {
            return unit === "P1M" ? t("experience.monthly") : unit === "P1Y" ? t("experience.annual") : unit;
        }
        function profileLabel() {
            return t(draft.billingProfile === "company" ? "experience.companyProfile" : "experience.individualProfile");
        }
        function cardLabel() {
            return t(draft.paymentMethod === "team" ? "experience.teamCard" : "experience.corporateCard");
        }
        function azureLabel() {
            return t(draft.azureSubscription === "sandbox" ? "experience.azureSandbox" : "experience.azureTeam");
        }
        function groupLabel() {
            return draft.resourceGroup === "evaluation" ? "demo-evaluation" : "demo-applications";
        }

        function readFields() {
            return {
                name: byId("subscriptionName").value,
                planId: byId("purchase-plan").value,
                termIndex: Number(byId("billing-term").value),
                quantity: Number(byId("quantity").value),
                billingProfile: byId("billing-profile").value,
                paymentMethod: byId("payment-method").value,
                azureSubscription: byId("azure-subscription").value,
                resourceGroup: byId("resource-group").value,
                accepted: byId("accept-terms").checked
            };
        }

        function fillTerms() {
            const select = byId("billing-term");
            select.replaceChildren();
            experience.terms(plan()).forEach(function (term, index) {
                const option = document.createElement("option");
                option.value = String(index);
                option.textContent = termLabel(term.termUnit);
                select.appendChild(option);
            });
            select.value = String(draft.termIndex);
            const perSeat = plan().isPricePerSeat === true;
            byId("quantity-field").hidden = !perSeat;
            byId("quantity").disabled = !perSeat;
            byId("quantity").required = perSeat;
            byId("review-button").disabled = select.options.length === 0;
            if (!select.options.length) showError("experience.noPrice");
        }

        function updateSummary() {
            byId("summary-product").textContent = experience.productName(offer, t);
            byId("summary-plan").textContent = plan().displayName;
            byId("summary-quantity-label").hidden = !plan().isPricePerSeat;
            byId("summary-quantity").hidden = !plan().isPricePerSeat;
            byId("summary-quantity").textContent = String(draft.quantity);
            byId("card-name").textContent = cardLabel();
            byId("card-digits").textContent = draft.paymentMethod === "team" ? "•••• 5555" : "•••• 4242";
            byId("profile-hint").textContent = t(draft.billingProfile === "company"
                ? "experience.companyPermission" : "experience.personalPayment");
            try {
                const value = experience.quote(plan(), draft.termIndex, draft.quantity);
                byId("summary-term").textContent = termLabel(value.termUnit);
                byId("summary-total").textContent = experience.price(value.total, value.currency, journey.context().culture);
            } catch (error) {
                byId("summary-total").textContent = t(error.message === "experience.quantityError"
                    ? "experience.quantityError" : "experience.noPrice");
                byId("summary-term").textContent = "";
            }
        }

        function addReview(label, value) {
            const dt = document.createElement("dt");
            const dd = document.createElement("dd");
            dt.textContent = t(label);
            dd.textContent = value;
            byId("review-details").append(dt, dd);
        }

        function renderStage() {
            byId("portal-redirect").hidden = stage !== "redirect";
            byId("checkout-surface").hidden = stage === "redirect";
            ["details", "review", "complete"].forEach(function (name) {
                byId("checkout-" + name).hidden = stage !== name;
            });
            document.querySelectorAll(".checkout-progress [data-stage]").forEach(function (item) {
                if (item.dataset.stage === stage) item.setAttribute("aria-current", "step");
                else item.removeAttribute("aria-current");
            });
            updateSummary();
            if (stage === "review") {
                byId("review-details").replaceChildren();
                addReview("common.subscriptionName", draft.name);
                addReview("common.plan", plan().displayName);
                addReview("experience.billingTerm", termLabel(experience.quote(plan(), draft.termIndex, draft.quantity).termUnit));
                if (plan().isPricePerSeat) addReview("experience.seats", String(draft.quantity));
                if (azure) {
                    addReview("experience.azureSubscription", azureLabel());
                    addReview("experience.resourceGroup", groupLabel());
                } else {
                    addReview("experience.billingProfile", profileLabel());
                    addReview("experience.paymentMethod", cardLabel());
                }
            }
            if (stage === "complete") {
                byId("demo-order-reference").textContent = t("experience.orderReference") + " " + draft.confirmation.id.slice(0, 8);
                const token = journey.purchaseToken(draft.confirmation).base64;
                byId("configure-account").href = journey.landingUrl(config.landingPageUrl, token);
            } else {
                byId("configure-account").removeAttribute("href");
            }
            document.title = t(stage === "complete" ? "experience.orderComplete"
                : stage === "review" ? "experience.reviewTitle" : azure ? "experience.azureCheckout" : "experience.webCheckout");
        }

        function changeStage(next, push = true) {
            stage = next;
            const valid = experience.validate(draft, plan(), scenario).length === 0;
            if ((stage === "review" && !valid) || (stage === "complete" && (!valid || !draft.confirmation))) {
                stage = "details";
                showError("experience.draftExpired");
            }
            const url = new URL(location.href);
            url.searchParams.set("stage", stage);
            url.searchParams.set("draft", draftId);
            url.searchParams.set("scenario", scenario);
            url.searchParams.set("offer", offer.offerId);
            url.searchParams.set("plan", draft.planId);
            if (push) history.pushState(null, "", url.pathname + url.search + url.hash);
            else history.replaceState(null, "", url.pathname + url.search + url.hash);
            journey.updateLinks();
            renderStage();
            const heading = document.querySelector(stage === "redirect" ? "#portal-redirect h2" : "#checkout-" + stage + " h2");
            heading.focus({ preventScroll: !push });
            if (push) heading.scrollIntoView({ block: "start" });
        }

        try {
            const offers = await journey.loadOffers();
            const selection = journey.selection(offers, query.get("offer"), query.get("plan"));
            if (!selection) throw new Error("journey.selectionError");
            if (!selection.planId) throw new Error("journey.noPlans");
            offer = selection.offer;
            const response = await fetch("/api/util/config");
            if (!response.ok) throw new Error("experience.configError");
            config = await response.json();
            const landing = new URL(config.landingPageUrl);
            if (!["https:", "http:"].includes(landing.protocol) || landing.username || landing.password)
                throw new Error("experience.configError");
            if (landing.hostname === "localhost" && !["localhost", "127.0.0.1"].includes(location.hostname))
                throw new Error("experience.configError");

            draft = {
                schema: 1, scenario: scenario, offerId: offer.offerId, planId: selection.planId,
                name: "workspace-demo", termIndex: 0, quantity: 1, billingProfile: "individual",
                paymentMethod: "corporate", azureSubscription: "team", resourceGroup: "applications",
                accepted: false, confirmation: null
            };
            let stored;
            try { stored = sessionStorage.getItem(storageKey); }
            catch (error) { throw new Error("experience.storageError"); }
            if (stored) {
                try {
                    const saved = JSON.parse(stored);
                    if (saved.schema !== 1 || saved.scenario !== scenario || saved.offerId !== offer.offerId ||
                        saved.planId !== selection.planId || typeof saved.name !== "string" ||
                        !Number.isInteger(saved.termIndex)) throw new Error("draft");
                    draft = saved;
                    restored = true;
                    const order = draft.confirmation;
                    if (order && (typeof order.id !== "string" || order.offerId !== draft.offerId ||
                        order.planId !== draft.planId || order.name !== draft.name ||
                        !order.beneficiary || !order.purchaser)) draft.confirmation = null;
                } catch (error) {
                    showError("experience.draftExpired");
                }
            }
            if (!persist()) {
                byId("checkout-loading").hidden = true;
                return;
            }
        } catch (error) {
            const known = ["journey.selectionError", "journey.noPlans", "journey.catalogueError", "experience.storageError", "experience.configError"];
            showError(known.includes(error.message) ? error.message : "experience.configError");
            byId("checkout-loading").hidden = true;
            return;
        }

        document.body.classList.toggle("azure-checkout", azure);
        byId("checkout-chrome").textContent = t(azure ? "experience.azureSurface" : "experience.webSurface");
        byId("checkout-heading").textContent = t(azure ? "experience.azureCheckout" : "experience.webCheckout");
        byId("web-billing").hidden = azure;
        byId("azure-project").hidden = !azure;
        document.querySelectorAll("#web-billing select").forEach(node => { node.disabled = azure; });
        document.querySelectorAll("#azure-project select").forEach(node => { node.disabled = !azure; });
        byId("review-button").textContent = t(azure ? "experience.reviewCreate" : "experience.reviewOrder");
        const back = journey.withContext("/start.html");
        back.searchParams.set("offer", offer.offerId);
        back.searchParams.set("plan", draft.planId);
        byId("back-product").href = back.href;
        Object.entries(offer.plans).forEach(function ([id, value]) {
            const option = document.createElement("option");
            option.value = id;
            option.textContent = value.displayName;
            byId("purchase-plan").appendChild(option);
        });
        byId("purchase-plan").value = draft.planId;
        byId("subscriptionName").value = draft.name;
        byId("quantity").value = draft.quantity;
        byId("billing-profile").value = draft.billingProfile;
        byId("payment-method").value = draft.paymentMethod;
        byId("azure-subscription").value = draft.azureSubscription;
        byId("resource-group").value = draft.resourceGroup;
        byId("accept-terms").checked = draft.accepted === true;
        fillTerms();
        byId("checkout-loading").hidden = true;
        const requestedStage = query.get("stage");
        let first = stageNames.includes(requestedStage) ? requestedStage : scenario === "web-azure" ? "redirect" : "details";
        if (first === "redirect" && scenario !== "web-azure") first = "details";
        if (!restored && ["review", "complete"].includes(first)) {
            first = "details";
            showError("experience.draftExpired");
        }
        changeStage(first, false);

        form.addEventListener("input", function (event) {
            errorBox.hidden = true;
            if (event.target.id === "purchase-plan") {
                draft.planId = byId("purchase-plan").value;
                draft.termIndex = 0;
                fillTerms();
            }
            Object.assign(draft, readFields(), { confirmation: null });
            journey.updateSelection(offer.offerId, draft.planId, scenario);
            const back = journey.withContext("/start.html");
            back.searchParams.set("offer", offer.offerId);
            back.searchParams.set("plan", draft.planId);
            byId("back-product").href = back.href;
            updateSummary();
            persist();
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            Object.assign(draft, readFields());
            const errors = experience.validate(draft, plan(), scenario);
            form.querySelectorAll("[aria-invalid]").forEach(node => node.removeAttribute("aria-invalid"));
            if (errors.length) {
                showError("experience.validationError");
                errors.forEach(id => byId(id).setAttribute("aria-invalid", "true"));
                byId(errors[0]).focus();
                return;
            }
            errorBox.hidden = true;
            if (persist()) changeStage("review");
        });
        byId("continue-azure").addEventListener("click", () => changeStage("details"));
        byId("edit-order").addEventListener("click", () => changeStage("details"));
        byId("place-order").addEventListener("click", function () {
            if (stage !== "review") return;
            const party = { emailId: "demo.user@example.invalid", objectId: journey.newId(), tenantId: journey.newId() };
            draft.confirmation = {
                id: journey.newId(), name: draft.name.trim(), offerId: offer.offerId, planId: draft.planId,
                beneficiary: party, purchaser: { ...party }, quantity: plan().isPricePerSeat ? draft.quantity : null
            };
            draft.name = draft.name.trim();
            if (persist()) changeStage("complete");
        });
        window.addEventListener("popstate", function () {
            const next = new URLSearchParams(location.search).get("stage");
            changeStage(stageNames.includes(next) ? next : "details", false);
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
}());
