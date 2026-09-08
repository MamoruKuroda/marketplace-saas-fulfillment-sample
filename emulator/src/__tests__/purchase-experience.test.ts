import { generateSampleOffer } from '../helpers/offer-helper';

const experienceCases: Array<[string, () => void | Promise<void>]> = require('./purchase-experience-cases');

describe('Simulated buying experience', () => {
  test.each(experienceCases)('%s', (_name, run) => run());

  test('built-in catalogue uses the USD 50 base for fixed demo display prices', () => {
    const offer = generateSampleOffer('sample', 'Sample', false, false);
    for (const plan of Object.values(offer.plans)) {
      expect(plan.planComponents.recurrentBillingTerms[0].currency).toBe('USD');
      expect(plan.planComponents.recurrentBillingTerms[0].price).toBe(50);
    }
  });
});
