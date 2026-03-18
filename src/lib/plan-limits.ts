interface PlanLimits {
  readonly maxChests: number;
  readonly maxAgents: number;
}

const LIMITS: Record<string, PlanLimits> = {
  free: { maxChests: 3, maxAgents: 2 },
  pro: { maxChests: Infinity, maxAgents: Infinity },
};

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return LIMITS[plan ?? 'free'] ?? LIMITS.free;
}
