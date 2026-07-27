export const SUBSCRIPTION_PLAN_LIMITS = {
  starter: { maxBranches: 1 },
  standard: { maxBranches: 3 },
  scale: { maxBranches: null },
} as const;

export type SubscriptionPlanCode = keyof typeof SUBSCRIPTION_PLAN_LIMITS;

export function getSubscriptionPlanBranchLimit(plan: SubscriptionPlanCode): number | null {
  return SUBSCRIPTION_PLAN_LIMITS[plan].maxBranches;
}
