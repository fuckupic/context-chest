import { getPlanLimits } from '../../lib/plan-limits';

describe('getPlanLimits', () => {
  it('returns strict limits for free plan', () => {
    const limits = getPlanLimits('free');
    expect(limits.maxChests).toBe(3);
    expect(limits.maxAgents).toBe(2);
  });

  it('returns unlimited for pro plan', () => {
    const limits = getPlanLimits('pro');
    expect(limits.maxChests).toBe(Infinity);
    expect(limits.maxAgents).toBe(Infinity);
  });

  it('defaults to free for unknown input', () => {
    const limits = getPlanLimits(undefined as unknown as string);
    expect(limits.maxChests).toBe(3);
  });
});
