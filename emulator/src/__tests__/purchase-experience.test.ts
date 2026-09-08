const experienceCases: Array<[string, () => void | Promise<void>]> = require('./purchase-experience-cases');

describe('Simulated buying experience', () => {
  test.each(experienceCases)('%s', (_name, run) => run());
});
