// Subscription plans, billed monthly or yearly. Either way, a plan grants
// its credits every month: a yearly plan grants the first month with the
// charge and the other eleven as each month begins (grantYearlyMonths).
// Unused credits carry over. Amounts are per billing period, in the
// currency's smallest unit.
export const SUBSCRIPTION_PLANS = [
  { id: "pro", interval: "month", credits: 300, amount: 1000, currency: "usd" },
  { id: "pro-yearly", interval: "year", credits: 300, amount: 10800, currency: "usd" },
] as const;

export const PLAN_INTERVALS = ["month", "year"] as const;
export type PlanInterval = (typeof PLAN_INTERVALS)[number];

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export function findPlan(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === id);
}
