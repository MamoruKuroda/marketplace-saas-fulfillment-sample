/// <reference path="core.js" />

let config;

$(async () => {
    const journey = window.PurchaseJourney;
    const scenario = journey.context().scenario;
    $("#checkout-route").text(t(scenario ? "journey." + scenario + ".route" : "journey.directTitle"));
    $("#checkout-prerequisites").text(t(scenario ? "journey." + scenario + ".prerequisites" : "journey.directHint"));

    // Configure purchase form

    try {
        const {result, status} = await callAPI("/api/util/config");
        if (status !== 200 || !result || typeof result !== "object") throw new Error("config");
        config = result;
    } catch (error) {
        showCheckoutError("index.configError");
    }

    const defaultPurchaser = {
        email: "user@forthcoffee.com",
        oid: guid(),
        tid: guid()
    }

    $("#beneficiaryEmail,#purchaserEmail").val(defaultPurchaser.email);
    $("#beneficiaryOid,#purchaserOid").val(defaultPurchaser.oid);
    $("#beneficiaryTid,#purchaserTid").val(defaultPurchaser.tid);

    const $purchaserInputs = $("#purchaserEmail,#purchaserOid,#purchaserTid");
    const $purchaserToggle = $("#purchaserIsBeneficiary");
    const $toggleOptionalFields = $("section.purchase .toggle-optional a");
    const $planSelect = $("section.purchase select");

    $purchaserToggle.on("change", () => {
        $purchaserInputs.attr("disabled", !$purchaserToggle.is(":checked")).parent().toggleClass("hidden", !$purchaserToggle.is(":checked"));
    });

    let displayOptionalFields = false;
    $toggleOptionalFields.on("click", () => {
            $("section.purchase div.optional").toggleClass("hidden", displayOptionalFields);
            $purchaserToggle.trigger("change");
            displayOptionalFields = !displayOptionalFields;
            $toggleOptionalFields.text(!displayOptionalFields ? t("common.showOptionalFields") : t("common.hideOptionalFields"));
            return false;
        });

    $planSelect.on("change", () => {
        const offer = $planSelect.data("offer");
        const plan = offer.plans[$planSelect.val()];
        $("section.purchase .seat-count input").val('');
        $("section.purchase .seat-count").css({visibility: plan && plan.isPricePerSeat ? 'visible' : 'hidden'});
        $("#purchaseButton,#viewJsonButton,#viewTokenButton").prop("disabled", !plan);
        journey.updateSelection(offer.offerId, $planSelect.val() || "");
    });

    // Configure buttons

    $("#viewJsonButton").on("click", showJson);
    $("#viewTokenButton").on("click", showToken);
    $("#purchaseButton").on("click", postToLanding);

    // Retrieve offers

    let offers;
    try {
        offers = await journey.loadOffers();
    } catch (error) {
        showCheckoutError("journey.catalogueError");
        $('section.purchase').hide();
        return;
    }
    if (offers.length === 0) {
        showCheckoutError("journey.noOffers");
        $('section.purchase').hide();
        return;
    }
    offers.forEach(offer => renderOffer($("section.offers"), offer, t("common.getItNow"), () => {
        selectOffer(offer);
        return false;
    }));

    const requested = new URLSearchParams(window.location.search);
    let selected;
    try {
        selected = journey.selection(offers, requested.get("offer"), requested.get("plan"));
    } catch (error) {
        showCheckoutError("journey.selectionError");
        return;
    }
    if (selected) selectOffer(selected.offer, selected.planId);
});

function showCheckoutError(key) {
    $("#checkout-error").text(t(key)).prop("hidden", false);
}

function selectOffer(offer, planId) {
    if (config) $("#checkout-error").prop("hidden", true);
    else showCheckoutError("index.configError");
    $("section.purchase > div").removeClass("hidden");
    $("section.purchase > div.placeholder").addClass("hidden");
    $("#subscriptionId").val(guid());

    $("section.purchase .offer > span:first-child").text(offer.displayName);
    $("section.purchase .offer > span:last-child").text(offer.publisher);

    const $plans = $("section.purchase select").empty().data("offer", offer);

    for (const planId in offer.plans) {
        if (!Object.prototype.hasOwnProperty.call(offer.plans, planId)) {
            continue;
        }

        const plan = offer.plans[planId];

        $plans.append($("<option></option>")
            .text(planId + " - " + plan.displayName)
            .val(planId));
    }

    if (planId) $plans.val(planId);
    $plans.trigger("change");
    if (!$plans.val()) showCheckoutError("journey.noPlans");
}

function generateToken() {

    const beneficiaryAsPurchaser = !$("#purchaserIsBeneficiary").is(":checked");
    const $plans = $("section.purchase select");

    const sub = { 
        "id": $('#subscriptionId').val(),
        "name": $('#subscriptionName').val(),
        "offerId": $plans.data("offer").offerId,
        "planId": $plans.val(),
        "beneficiary": {
            "emailId": $('#beneficiaryEmail').val(),
            "objectId": $('#beneficiaryOid').val(),
            "tenantId": $('#beneficiaryTid').val()
        },
        "purchaser": {
            "emailId": beneficiaryAsPurchaser ? $("#beneficiaryEmail").val() : $("#purchaserEmail").val(),
            "objectId": beneficiaryAsPurchaser ? $('#beneficiaryOid').val() : $("#purchaserOid").val(),
            "tenantId": beneficiaryAsPurchaser ? $('#beneficiaryTid').val() : $("#purchaserTid").val()
        },
        "quantity": parseInt($('#quantity').val()),
        "autoRenew": false,
        "isTest": false,
        "isFreeTrial": false
    }

    return window.PurchaseJourney.purchaseToken(sub);
}

async function showJson() {
    const {json} = generateToken();
    await showDialog(`<pre>${highlightJson(json)}</pre>`, t("common.subscriptionJson"), {
        [t("common.copy")]: ($btn) => {
            $btn.text(t("common.copied"));
            navigator.clipboard.writeText(json);
            window.setTimeout(() => $btn.text(t("common.copy")), 2000);
        }
    });
}

async function showToken() {
    const {base64} = generateToken();
    await showDialog(`<pre>${base64}</pre>`, t("common.marketplaceToken"), {
        [t("common.copy")]: ($btn) => {
            $btn.text(t("common.copied"));
            navigator.clipboard.writeText(base64);
            window.setTimeout(() => $btn.text(t("common.copy")), 2000);
        }
    });
}

// post the token to the given landing page URL
async function postToLanding() {
    const {base64} = generateToken();

    if (config === undefined) {
      await showAlert(t("index.configError"), t("common.error"));
      return;
    }

    const landingPage = config.landingPageUrl;

    if (!landingPage) {
        await showAlert(t("index.noLandingPageUrl"), t("nav.landingPage"));
        return;
    }

    if (checkLandingPageUrl(landingPage)) {
        const ok = await showYesNo(t('index.remoteLandingConfirmHtml'), t('nav.landingPage'));
        if (!ok) {
            return;
        }
    }

    const target = window.PurchaseJourney.landingUrl(landingPage, base64);

    if (config.landingPageUrl.toLowerCase().startsWith(window.location.origin.toLowerCase())) {
        window.location.href = target;
    }
    else {
        window.open(target, '_blank');
    }
  }

  // Check if we're running on a remote host but the landing page has been left as default (localhost)
  function checkLandingPageUrl(landingPageUrl) {
    return landingPageUrl.startsWith('http://localhost') && $(location).attr('hostname') !== 'localhost';
  }