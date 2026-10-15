// Credit packs for sale. Checkout prices them inline, so Stripe needs no
// products or prices set up. Amounts are in the currency's smallest unit.
export const CREDIT_PACKS = [
  { id: "small", credits: 100, amount: 500, currency: "usd" },
  { id: "medium", credits: 450, amount: 2000, currency: "usd" },
  { id: "large", credits: 1000, amount: 4000, currency: "usd" },
] as const;

export type CreditPack = (typeof CREDIT_PACKS)[number];

export function findPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}
