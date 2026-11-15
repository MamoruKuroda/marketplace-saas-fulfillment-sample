const model = require('../client/web-checkout-model.js');

describe('Web checkout training model', () => {
  test('general training defaults to manual activation, independently of the observation preset', () => {
    const state = model.initial();
    expect(state.activation).toBe('manual');
    model.selectPreset(state, 'observation');
    expect(state.activation).toBe('auto');
    expect(state.planCount).toBe('one');
    model.selectPreset(state, 'general');
    expect(state.activation).toBe('manual');
    expect(state.planCount).toBe('multiple');
    expect(() => model.selectPreset(state, 'unknown')).toThrow('invalid preset');
  });

  test('pricing follows the selected plan and term', () => {
    const state = model.initial();
    state.plan = 'team';
    state.term = 3;
    expect(model.quote(state)).toEqual({ amount: 12000, total: 36000, frequency: 'year' });
    state.planCount = 'one';
    expect(() => model.quote(state)).toThrow('invalid plan or term');
  });

  test('upfront and annual payment frequencies show consistent term totals', () => {
    const state = model.initial();
    state.term = 3;
    expect(model.quote(state)).toEqual({ amount: 7500, total: 22500, frequency: 'year' });
    state.paymentFrequency = 'oneTime';
    expect(model.quote(state)).toEqual({ amount: 22500, total: 22500, frequency: 'oneTime' });
    state.preset = 'observation';
    state.plan = 'observed';
    state.term = 1;
    expect(model.quote(state).frequency).toBe('year');
    state.term = 2;
    expect(model.quote(state).frequency).toBe('oneTime');
  });

  test('country, route, commercial terms, activation and renewal are independent', () => {
    const state = model.initial();
    Object.assign(state, { countryStep: true, country: 'US', route: 'azure', commercial: 'private', activation: 'auto', renew: false, profile: 'sample' });
    expect(model.complete(state)).toBe(true);
    expect(state.subscriptionState).toBe('Subscribed');
    expect(state.productReadiness).toBe('unconfirmed');
    expect(state.renew).toBe(false);
    expect(state.route).toBe('azure');
  });

  test('manual activation remains distinct from automatic subscription', () => {
    const state = model.initial();
    state.profile = 'sample';
    expect(model.complete(state)).toBe(true);
    expect(state.subscriptionState).toBe('PendingFulfillmentStart');
    expect(state.productReadiness).toBe('unconfirmed');
  });

  test('manual handoff freezes the fictional plan, term and renewal without billing details', () => {
    const state = model.initial();
    Object.assign(state, { profile: 'sample', plan: 'team', term: 3, renew: false });
    expect(model.complete(state)).toBe(true);
    const id = 'a4d37bf6-5f12-49e2-b2c2-20a0f1f263be';
    const purchase = model.manualPurchase(state, id);
    Object.assign(state, { plan: 'basic', term: 1, renew: true });
    expect(purchase).toMatchObject({
      id, offerId: 'web-checkout-training', planId: 'team',
      term: { termUnit: 'P3Y' }, autoRenew: false, isTest: true
    });
    expect(purchase.beneficiary.emailId).toBe('demo.user@example.invalid');
    expect(purchase).not.toHaveProperty('profile');
    expect(purchase).not.toHaveProperty('price');
    expect(() => model.manualPurchase(state, 'invalid')).toThrow('invalid manual purchase');
    state.activation = 'auto';
    expect(() => model.manualPurchase(state, id)).toThrow('invalid manual purchase');
  });

  test('requires a profile and prevents duplicate or observation-reference orders', () => {
    const state = model.initial();
    expect(model.complete(state)).toBe(false);
    state.profile = 'sample';
    expect(model.complete(state)).toBe(true);
    expect(model.complete(state)).toBe(false);
    const observed = model.initial();
    observed.preset = 'observation';
    observed.plan = 'observed';
    observed.profile = 'sample';
    expect(model.quote(observed).total).toBe(0);
    expect(model.complete(observed)).toBe(false);
    expect(observed.subscriptionState).toBe('notOrdered');
  });
});
