const selectionCases: Array<[string, () => void | Promise<void>]> = require('./subscription-selection-cases');

describe('Emulator operations selection and progressive disclosure', () => {
  test.each(selectionCases)('%s', (_name, run) => run());
});
