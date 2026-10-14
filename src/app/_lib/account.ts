import { cache } from "react";
import { getBalance } from "@/server/credits";
import { getCurrentSubscription } from "@/server/payment/subscriptions";

// A user's balance and live subscription. The dashboard layout shows both,
// and pages such as /billing show them again: React's cache shares one
// query per user between them during one render.
export const userBalance = cache((userId: string) => getBalance(userId));
export const userSubscription = cache((userId: string) => getCurrentSubscription(userId));
