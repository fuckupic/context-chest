import { getPlanLimits } from '../../lib/plan-limits';

describe('chest router plan limits', () => {
  it('free user with 3 chests should not create new ones', () => {
    const limits = getPlanLimits('free');
    const chestCount = 3;
    const shouldSkipCreation = chestCount >= limits.maxChests;
    expect(shouldSkipCreation).toBe(true);
  });

  it('pro user with 3 chests can create more', () => {
    const limits = getPlanLimits('pro');
    const chestCount = 3;
    const shouldSkipCreation = chestCount >= limits.maxChests;
    expect(shouldSkipCreation).toBe(false);
  });

  it('free user with 2 chests can still create one more', () => {
    const limits = getPlanLimits('free');
    const chestCount = 2;
    const shouldSkipCreation = chestCount >= limits.maxChests;
    expect(shouldSkipCreation).toBe(false);
  });
});
