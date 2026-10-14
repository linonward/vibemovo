import { RAP_CREDITS } from "@/server/videos/config";

// One rap video's credits sell for $9.90; bigger packs take a percentage
// off. Amounts are in the currency's smallest unit.
const VIDEO_PRICE = 990;

function pack(videos: number, discount: number) {
  return {
    id: `video-${videos}`,
    credits: videos * RAP_CREDITS,
    amount: Math.round(videos * VIDEO_PRICE * (1 - discount / 100)),
    currency: "usd",
    videos,
    discount,
  };
}

// Credit packs for sale. Checkout prices them inline, so Stripe needs no
// products or prices set up.
export const CREDIT_PACKS = [pack(1, 0), pack(3, 10), pack(5, 15), pack(10, 20)] as const;

export type CreditPack = (typeof CREDIT_PACKS)[number];

export function findPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}
