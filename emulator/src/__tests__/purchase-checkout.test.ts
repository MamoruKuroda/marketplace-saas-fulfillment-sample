const checkoutCases: Array<[string, () => void | Promise<void>]> = require('./purchase-checkout-cases');

describe('Simulated checkout controller', () => {
  test.each(checkoutCases)('%s', (_name, run) => run());
});
