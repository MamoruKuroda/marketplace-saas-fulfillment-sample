/// <reference path="core.js" />

let offers;
let partnerLanding;
let selectedScrolled = false;

function reportError(message) {
  const error = document.getElementById('subscriptions-error');
  error.textContent = error.textContent ? error.textContent + '\n' + message : message;
  error.hidden = false;
}

async function checkedAPI(path, method) {
  const response = await callAPI(path, method);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${t('subs.requestError')} (${response.status}): ${typeof response.result === 'string' ? response.result : JSON.stringify(response.result) || ''}`);
  }
  return response.result;
}

function subscriptionRows() {
  return Array.from(document.querySelectorAll('tr[data-sid]'));
}

function updateSubscriptionSelection() {
  const rows = subscriptionRows();
  const selection = window.EmulatorSubscriptions.select(window.location.search, rows.map(row => row.getAttribute('data-sid')));
  const selected = selection.kind === 'selected';
  rows.forEach(row => {
    const current = selected && row.getAttribute('data-sid') === selection.id;
    row.hidden = selected && !current;
    row.classList.toggle('selected-subscription', current);
    if (current) row.setAttribute('aria-selected', 'true');
    else row.removeAttribute('aria-selected');
    if (current && !selectedScrolled) {
      row.scrollIntoView({ block: 'nearest' });
      selectedScrolled = true;
    }
  });
  document.querySelectorAll('tr.publisher-heading').forEach(row => { row.hidden = selected; });
  const status = document.getElementById('subscription-selection-status');
  status.textContent = selection.kind === 'all' ? t('subs.allRecords') :
    selection.kind === 'invalid' ? t('subs.invalidSelection') :
    formatI18n(selected ? 'subs.selected' : 'subs.notFound', { id: selection.id });
  const clear = document.getElementById('subscriptions-show-all');
  clear.href = window.EmulatorSubscriptions.showAllUrl();
  clear.hidden = selection.kind === 'all';
  const partner = document.getElementById('partner-record');
  partner.hidden = true;
  partner.removeAttribute('href');
  if (selected && partnerLanding) {
    partner.href = window.EmulatorSubscriptions.partnerUrl(partnerLanding, selection.id);
    partner.hidden = false;
  }
}

async function loadPartnerLinks() {
  try {
    const config = await checkedAPI('/api/util/config');
    // Validate the configured origin without retaining configured query/token values.
    window.EmulatorSubscriptions.partnerUrl(config.landingPageUrl, '00000000-0000-0000-0000-000000000000');
    partnerLanding = config.landingPageUrl;
  } catch (error) {
    const status = document.getElementById('partner-record-status');
    status.textContent = t('subs.partnerUnavailable') + ' ' + error.message;
    status.hidden = false;
  }
}

$(async () => {
  try {
    const results = await Promise.all([checkedAPI('/api/util/offers'), checkedAPI('/api/util/publishers'), loadPartnerLinks()]);
    offers = results[0];
    const result = results[1];
    const publisherRowTemplate = $('#publisher-row');
    for (const pid in result) {
      const publisherSubscriptions = result[pid];
      publisherRowTemplate
        .clone()
        .appendTo(publisherRowTemplate.parent())
        .removeClass('template')
        .addClass('publisher-heading')
        .attr('id', '')
        .children('td')
        .text(t("common.publisherIdPrefix") + pid);
      for (const sid in publisherSubscriptions) {
        addRow(publisherSubscriptions[sid].subscription);
      }
    }
    updateSubscriptionSelection();
    const legacyId = window.location.hash.substring(1);
    if (window.EmulatorSubscriptions.validId(legacyId)) {
      subscriptionRows().filter(row => row.getAttribute('data-sid') === legacyId)
        .forEach(row => row.classList.add('animate-fade'));
    }
  } catch (error) {
    reportError(t('subs.loadError') + ' ' + error.message);
  }
});

$(document).on('subscription-update', async (e, sid, pid) => {
  try {
    const result = await checkedAPI(`/api/util/publishers/${pid}/subscriptions/${sid}`);
    const row = addRow(result);
    row.addClass('animate-fade');
    updateSubscriptionSelection();
  } catch (error) {
    reportError(error.message);
  }
});

function addRow(subscription) {
  const subscriptionRowTemplate = $('#subscription-row');
  const noOfferRowTemplate = $('#missing-offer-row');

  const offer = offers[subscription.offerId];
  let row;

  if (offer) {
    row = subscriptionRowTemplate.clone().removeClass('template').attr({ id: '', 'data-sid': subscription.id });
  } else {
    row = noOfferRowTemplate.clone().removeClass('template').attr({ id: '', 'data-sid': subscription.id });
    row.find('button').data({
        subscriptionId: subscription.id,
        planID: subscription.planId,
        publisherId: subscription.publisherId
      });
  }

  const replace = subscriptionRowTemplate.parent().children('tr[data-sid]').filter((_, item) => item.getAttribute('data-sid') === subscription.id);

  if (replace.length !== 0) {
    row.insertAfter(replace);
    replace.remove();
  } else {
    row.appendTo(subscriptionRowTemplate.parent());
  }

  if (offer) {
    row.addClass(subscription.saasSubscriptionStatus.toLowerCase());

    const cells = row.children('td');
    const status = subscription.saasSubscriptionStatus;

    const id = subscription.id;

    $(cells[0])
      .text(id.substring(0, 4) + ' ... ' + id.substring(id.length - 4, id.length))
      .attr('title', id);
    $(cells[0]).attr('title', id).data('copy', id);
    $(cells[1]).text(subscription.name);
    $(cells[2]).text(subscription.offerId).data('copy', subscription.offerId);
    $(cells[3]).text(subscription.planId).data('copy', subscription.planId);
    $(cells[4]).text(offer.plans[subscription.planId]?.isPricePerSeat ? subscription.quantity : '-');
    if (status === 'PendingFulfillmentStart') {
      $(cells[5]).text(t('status.PendingFulfillmentStart'));
    } else {
      const statusText = t('status.' + status);
      $(cells[5]).text(statusText === 'status.' + status ? status : statusText);
    }

    $(cells[6])
      .children('button')
      .each((i, e) => {
        const button = $(e);
        const requiredStatus = button.attr('data-requiredStatus');
        let enabled = false;

        if (requiredStatus.startsWith('!') && status != 'Unsubscribed') {
          enabled = requiredStatus.substring(1) != status;
        } else {
          enabled = requiredStatus == status;
        }

        if (button.is('.change-quantity')) {
          if (!offer.plans[subscription.planId]?.isPricePerSeat) {
            enabled = false;
          }
        }

        button.attr('disabled', !enabled).data({
          subscriptionId: subscription.id,
          planID: subscription.planId,
          publisherId: subscription.publisherId
        });
        if (enabled === false) {
          button.hide();
        }
      });

    $('section.main > .template.copy-icon')
      .clone()
      .removeClass('template')
      .appendTo(row.find('td.copy'))
      .on('click', (e) => {
        const $e = $(e.target);
        const td = $e.closest('td');
        navigator.clipboard.writeText(td.data('copy') || td.text());
        $e.closest('td').find('svg.copy').hide();
        $e.closest('td').find('svg.done').show();

        window.setTimeout(() => {
          $e.closest('td').find('svg.copy').show();
          $e.closest('td').find('svg.done').hide();
        }, 2000);
      });
  }

  if (partnerLanding && window.EmulatorSubscriptions.validId(subscription.id)) {
    $('<a></a>').addClass('partner-record-link')
      .attr({ href: window.EmulatorSubscriptions.partnerUrl(partnerLanding, subscription.id), target: '_blank', rel: 'noopener' })
      .text(t('subs.partnerRecord')).appendTo(row.children('td').last());
  }
  return row;
}

async function operationFetch(...args) {
  try {
    const response = await doFetch(...args);
    if (!response.ok) reportError(`${t('subs.requestError')} (${response.status}): ${await response.text()}`);
    return response;
  } catch (error) {
    reportError(`${t('subs.requestError')}: ${error.message}`);
    return null;
  }
}

async function activate_click(e) {
  const subscription = $(e.target).data('subscriptionId');
  const planId = { planId: $(e.target).data('planID') };
  const publisherId = $(e.target).data('publisherId');
  await operationFetch(
    '/activate',
    `api/saas/subscriptions/${subscription}/activate?publisherId=${publisherId}&api-version=2018-08-31`,
    JSON.stringify(planId)
  );
  $(e.target).attr('enabled', false);
}

async function delete_click(e) {
  if (
    !(await showYesNo(
      t('subs.deleteConfirmHtml'),
      t('subs.deleteTitle')
    ))
  ) {
    return;
  }

  const subscriptionId = $(e.target).data('subscriptionId');
  const publisherId = $(e.target).data('publisherId');

  try {
    await checkedAPI(`/api/util/publishers/${publisherId}/subscriptions/${subscriptionId}`, 'delete');
    subscriptionRows().filter(row => row.getAttribute('data-sid') === subscriptionId).forEach(row => row.remove());
    updateSubscriptionSelection();
  } catch (error) {
    reportError(error.message);
  }
}

// Resets the whole demo: this emulator's subscriptions, and the publisher app's copy of them.
//
// This is a test-harness convenience, not a Marketplace capability — there is no Fulfillment API
// that lets anyone delete a publisher's records. The button says so, and the publisher app only
// accepts the call when it has been explicitly configured for demos.
async function resetDemo_click() {
  if (!(await showYesNo(t('subs.resetConfirmHtml'), t('subs.resetTitle')))) {
    return;
  }

  let publishers;
  try {
    publishers = await checkedAPI('/api/util/publishers');
  } catch (error) {
    reportError(error.message);
    return;
  }

  let removedHere = 0;
  for (const pid in publishers) {
    for (const sid in publishers[pid]) {
      try {
        await checkedAPI(`/api/util/publishers/${pid}/subscriptions/${sid}`, 'delete');
        subscriptionRows().filter(row => row.getAttribute('data-sid') === sid).forEach(row => row.remove());
        removedHere++;
      } catch (error) {
        reportError(error.message);
      }
    }
  }

  let publisherOutcome = t('subs.resetPublisherUnavailable');
  updateSubscriptionSelection();
  let config;
  try {
    config = await checkedAPI('/api/util/config');
  } catch (error) {
    reportError(error.message);
  }
  if (config && config.landingPageUrl) {
    try {
      const url = config.landingPageUrl.replace(/\/$/, '') + '/api/demo/reset';
      // Browser calls require a CORS preflight. This is a demo safeguard, not authentication.
      const response = await fetch(url, { method: 'POST', headers: { 'X-Demo-Reset': '1' } });
      if (response.ok) {
        const body = await response.json();
        publisherOutcome = formatI18n('subs.resetPublisherDone', { count: body.cleared });
      } else {
        reportError(`${t('subs.requestError')} (${response.status}): ${await response.text()}`);
      }
    } catch (error) {
      reportError(`${t('subs.requestError')}: ${error.message}`);
    }
  }

  await showDialog(
    `<p>${formatI18n('subs.resetEmulatorDone', { count: removedHere })}</p><p>${publisherOutcome}</p>`,
    t('subs.resetTitle')
  );
}

async function changeQuantity_click(e) {
  const quantity = await showDialog($('#change-quantity-dialog'), t('action.changeQuantity'), {
    [t('common.ok')]: (button, body) => {
      const $input = body.find('input');
      const val = $input.val();
      if (val.trim() === '') {
        $input.attr('title', t('common.valueRequired')).addClass('invalid');
        return;
      }
      if (isNaN(val) || val <= 0 || val > 1000000) {
        $input.attr('title', t('common.invalidValue')).addClass('invalid');
        return;
      }
      return parseInt(val);
    }
  });

  if (typeof quantity === 'number' && !isNaN(quantity)) {
    await callWebhook(t('action.changeQuantityWebhook'), $(e.target).data('subscriptionId'), '', { quantity });
  }
}

async function getPlans(sub, pub) {
  return checkedAPI(
    `/api/saas/subscriptions/${sub}/listAvailablePlans/?publisherId=${pub}&api-version=2018-08-31`
  );
}

async function changePlan_click(e) {
  const subscription = $(e.target).data('subscriptionId');
  const publisherId = $(e.target).data('publisherId');
  const existingPlan = $(e.target).data('planID');

  let plansData;
  try {
    plansData = await getPlans(subscription, publisherId);
  } catch (error) {
    reportError(error.message);
    return;
  }

  const plansList = plansData.plans;

  if (plansList.length <= 1) {
    await showAlert(t('subs.noOtherPlans'), t('action.changePlan'));
    return;
  }

  const $dialog = $('#change-plan-dialog');
  const $select = $dialog.find('select').empty();

  $select.append(...plansList.map((x) => $('<option></option>').val(x.planId).text(x.displayName)));

  const planId = await showDialog($dialog, t('action.changePlan'), {
    [t('common.ok')]: (button, body) => {
      return body.find('select').val();
    }
  });

  if (typeof planId !== 'string' || planId === existingPlan) {
    return;
  }

  await callWebhook(t('action.changePlanWebhook'), $(e.target).data('subscriptionId'), '', { planId });
}

async function suspend_click(e) {
  await callWebhook(t('action.suspend'), $(e.target).data('subscriptionId'), 'suspend');
}

async function reinstate_click(e) {
  await callWebhook(t('action.reinstate'), $(e.target).data('subscriptionId'), 'reinstate');
}

async function unsubscribe_click(e) {
  await callWebhook(t('action.unsubscribe'), $(e.target).data('subscriptionId'), 'unsubscribe');
}

async function renew_click(e) {
  await callWebhook(t('action.renew'), $(e.target).data('subscriptionId'), 'renew');
}

async function callWebhook(name, sid, endpoint, body) {
  await operationFetch(
    '<b>[Webhook]</b> ' + name,
    `/api/webhook/subscription/${sid}/${endpoint}`,
    body ? JSON.stringify(body) : undefined,
    body ? 'PATCH' : 'POST'
  );
}
