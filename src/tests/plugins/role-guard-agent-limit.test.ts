import { getPlanLimits } from '../../lib/plan-limits';

describe('agent limit enforcement', () => {
  it('free plan allows 2 agents', () => {
    const limits = getPlanLimits('free');
    const agentCount = 2;
    const isNewAgent = true;
    const blocked = isNewAgent && agentCount >= limits.maxAgents;
    expect(blocked).toBe(true);
  });

  it('free plan allows existing agent even at limit', () => {
    const limits = getPlanLimits('free');
    const agentCount = 2;
    const isNewAgent = false;
    const blocked = isNewAgent && agentCount >= limits.maxAgents;
    expect(blocked).toBe(false);
  });

  it('pro plan allows unlimited agents', () => {
    const limits = getPlanLimits('pro');
    const agentCount = 100;
    const isNewAgent = true;
    const blocked = isNewAgent && agentCount >= limits.maxAgents;
    expect(blocked).toBe(false);
  });
});
