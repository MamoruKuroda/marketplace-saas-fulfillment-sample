const webCheckoutCases: Array<[string, () => void | Promise<void>]> = require('./web-checkout-controller-cases');

describe('Web checkout handoff controller', () => {
  test.each(webCheckoutCases)('%s', (_name, run) => run());
});
