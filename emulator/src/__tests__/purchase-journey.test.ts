const clientCases: Array<[string, () => void | Promise<void>]> = require('./purchase-journey-cases');

describe('Emulator purchase journey presentation', () => {
  test.each(clientCases)('%s', (_name, run) => run());
});
