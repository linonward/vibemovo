import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { user } from "@/server/auth/schema";
import { getDb } from "@/server/db";
import { PROVIDER_IDS, type ProviderId } from "@/server/payment/providers/types";
import { order } from "@/server/payment/schema";

export type AdminOrder = Awaited<ReturnType<typeof listAllOrders>>["orders"][number];

export type OrderStatus = (typeof order.$inferSelect)["status"];

export const ORDER_STATUSES = order.status.enumValues;

export const ORDER_PROVIDERS = PROVIDER_IDS;

export const ORDERS_PAGE_SIZE = 50;

// One page of credit-pack orders from every user, newest first, with the
// buyer's email. `query` matches part of the email (ignoring case), or an
// order ID or provider session ID exactly. `total` counts every match.
export async function listAllOrders({
  query = "",
  status,
  provider,
  page = 1,
  pageSize = ORDERS_PAGE_SIZE,
}: {
  query?: string;
  status?: OrderStatus;
  provider?: ProviderId;
  page?: number;
  pageSize?: number;
} = {}) {
  const db = getDb();
  const term = query.trim();
  // Escape LIKE wildcards so they match literally.
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const where = and(
    term
      ? or(ilike(user.email, pattern), eq(order.id, term), eq(order.providerSessionId, term))
      : undefined,
    status ? eq(order.status, status) : undefined,
    provider ? eq(order.provider, provider) : undefined,
  );

  const [orders, [{ total }]] = await Promise.all([
    db
      .select({
        id: order.id,
        userId: order.userId,
        email: user.email,
        packId: order.packId,
        credits: order.credits,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        provider: order.provider,
        providerSessionId: order.providerSessionId,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
      })
      .from(order)
      .innerJoin(user, eq(user.id, order.userId))
      .where(where)
      .orderBy(desc(order.createdAt), desc(order.id))
      .limit(pageSize)
      .offset((Math.max(1, page) - 1) * pageSize),
    db
      .select({ total: count() })
      .from(order)
      .innerJoin(user, eq(user.id, order.userId))
      .where(where),
  ]);
  return { orders, total };
}
