import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { grantCredits, spendCredits } from "@/server/credits";
import { getDb, type Tx } from "@/server/db";
import { log } from "@/server/log";
import { notify } from "@/server/notifications";
import type { NotificationContent } from "@/server/notifications/types";
import { deletePrefix, putObject, storageConfigured } from "@/server/storage";
import type { GenerationRow, GenerationTable } from "./columns";

// What a provider says about a submitted job.
export type GenerationResult =
  | { status: "pending" }
  | { status: "succeeded"; url: string }
  | { status: "failed"; code?: string; error: string };

// A kind's table: generationColumns() plus its own.
type Table = { $inferSelect: GenerationRow };
type Row<T extends Table> = T["$inferSelect"];

// One kind of generation (images, videos). The lifecycle is the same for
// every kind: spend the credits, submit a job, poll the provider until it
// finishes, copy the result to storage, and refund if anything fails. A kind
// supplies only what differs.
export type GenerationKind<T extends Table, N extends string> = {
  // Names the credit keys and reasons ("image:<id>", "image refund"), the
  // log prefix and the storage folder ("images/"). Renaming it would refund
  // jobs already in flight twice.
  name: N;
  table: T;
  // The column with the provider's ID for the job, set once it's submitted.
  jobColumn: AnyPgColumn;
  jobId(row: Row<T>): string | null;
  // Credits the job cost, refunded if it fails.
  credits(row: Row<T>): number;
  poll(row: Row<T>, jobId: string): Promise<GenerationResult>;
  // The finished file, stored as `${name}s/<userId>/<id>.<ext>`.
  output: { ext: string; mime: string; timeoutMs: number; error: (message: string) => Error };
  notification: {
    succeeded(row: Row<T>): NotificationContent;
    failed(row: Row<T>, credits: number): NotificationContent;
  };
  // Called when the sweep settles a job, so nobody had the page open to see
  // it, once per job. For an email; it must not throw.
  unwatched?: {
    succeeded(row: Row<T>): Promise<void>;
    failed(row: Row<T>, credits: number): Promise<void>;
  };
  // The sweep's reason for failing a job the provider never finished.
  neverFinished: string;
  stale: { afterMs: number; giveUpAfterMs: number; batch: number };
};

// Failure reasons a kind's metrics list, most common first.
const TOP_ERRORS = 5;

// Jobs the sweep fails per run. Failing touches only the database.
const LOST_BATCH = 100;
// Jobs the sweep fails, or asks providers about, at once.
const SWEEP_CONCURRENCY = 4;

// Runs `fn` on every item, at most `limit` at a time.
async function eachLimited<I>(items: I[], limit: number, fn: (item: I) => Promise<void>) {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

export function lifecycle<T extends Table, N extends string>(kind: GenerationKind<T, N>) {
  const { name, jobColumn } = kind;
  // Queries go through the shared columns, which every kind's table has;
  // rows come back as the kind's own.
  const table = kind.table as unknown as GenerationTable;
  const row = (r: unknown) => r as Row<T>;
  const fileKey = (userId: string, id: string, ext: string) => `${name}s/${userId}/${id}.${ext}`;
  const own = (userId: string, id?: string) =>
    id === undefined ? eq(table.userId, userId) : and(eq(table.id, id), eq(table.userId, userId));

  async function current(id: string): Promise<Row<T>> {
    const [found] = await getDb().select().from(table).where(eq(table.id, id));
    return row(found);
  }

  // Marks a pending job failed, refunds it and notifies the user. Returns
  // the current row. The status and the refund commit together, and only
  // the call that changed the status refunds: a job another call settled
  // first keeps its outcome, and a crash leaves the job pending for the sweep.
  async function fail(
    userId: string,
    id: string,
    credits: number,
    error: string,
    { unwatched = false } = {},
  ): Promise<Row<T>> {
    const failed = await getDb().transaction(async (tx) => {
      const [updated] = await tx
        .update(table)
        .set({ status: "failed", error, completedAt: new Date() })
        .where(and(eq(table.id, id), eq(table.status, "pending")))
        .returning();
      if (updated) {
        await grantCredits({
          userId,
          amount: credits,
          reason: `${name} refund`,
          idempotencyKey: `${name}-refund:${id}`,
          tx,
        });
      }
      return updated;
    });
    if (!failed) return current(id);
    log.warn(`${name}.failed`, { id, userId, credits, error });
    const fresh = await notify(userId, `${name}:${id}`, kind.notification.failed(row(failed), credits));
    if (fresh && unwatched) await kind.unwatched?.failed(row(failed), credits);
    return row(failed);
  }

  // The user's job, after asking the provider about a pending one. A
  // finished job is copied to storage; a failed one is refunded. Null if not
  // found. Throws if the provider or storage fails, leaving the job pending
  // for a retry.
  // `unwatched` is set by the sweep: nobody is on the page.
  async function refresh(userId: string, id: string, { unwatched = false } = {}): Promise<Row<T> | null> {
    const [found] = await getDb().select().from(table).where(own(userId, id));
    if (!found) return null;
    const job = row(found);
    const jobId = kind.jobId(job);
    if (found.status !== "pending" || !jobId) return job;

    const result = await kind.poll(job, jobId);
    if (result.status === "pending") return job;
    if (result.status === "failed") return fail(userId, id, kind.credits(job), result.error, { unwatched });

    const storageKey = fileKey(userId, id, kind.output.ext);
    await putObject(storageKey, await download(result.url), kind.output.mime);
    // Two refreshes can race here; both store the same file and either update wins.
    const [updated] = await getDb()
      .update(table)
      .set({ status: "succeeded", storageKey, completedAt: new Date() })
      .where(and(eq(table.id, id), eq(table.status, "pending")))
      .returning();
    if (updated) {
      const ms = updated.completedAt && updated.completedAt.getTime() - updated.createdAt.getTime();
      log.info(`${name}.succeeded`, { id, userId, ms });
      const fresh = await notify(userId, `${name}:${id}`, kind.notification.succeeded(row(updated)));
      if (fresh && unwatched) await kind.unwatched?.succeeded(row(updated));
    }
    return updated ? row(updated) : current(id);
  }

  return {
    refresh: (userId: string, id: string) => refresh(userId, id),
    fileKey,

    // The user's job as stored, without asking the provider. Null if not found.
    async get(userId: string, id: string): Promise<Row<T> | null> {
      const [found] = await getDb().select().from(table).where(own(userId, id));
      return found ? row(found) : null;
    },

    // The storage key of the user's finished job. Null if not found or not stored.
    async storedKey(userId: string, id: string): Promise<string | null> {
      const [found] = await getDb()
        .select({ storageKey: table.storageKey })
        .from(table)
        .where(and(own(userId, id), eq(table.status, "succeeded")));
      return found?.storageKey ?? null;
    },

    // The user's finished jobs.
    count(userId: string): Promise<number> {
      return getDb().$count(table, and(own(userId), eq(table.status, "succeeded")));
    },

    // The user's newest jobs.
    async list(userId: string, limit: number): Promise<Row<T>[]> {
      const rows = await getDb().select().from(table).where(own(userId)).orderBy(desc(table.createdAt)).limit(limit);
      return rows.map(row);
    },

    // One page of the user's jobs, newest first. `total` counts them all.
    async page(userId: string, page: number, pageSize: number): Promise<{ rows: Row<T>[]; total: number }> {
      const db = getDb();
      const [rows, total] = await Promise.all([
        db
          .select()
          .from(table)
          .where(own(userId))
          .orderBy(desc(table.createdAt), desc(table.id))
          .limit(pageSize)
          .offset((Math.max(1, page) - 1) * pageSize),
        db.$count(table, own(userId)),
      ]);
      return { rows: rows.map(row), total };
    },

    // Deletes the user's stored files. Their rows go with the user.
    async deleteUserFiles(userId: string): Promise<void> {
      if (storageConfigured()) await deletePrefix(`${name}s/${userId}/`);
    },

    // How jobs created between `since` and `until` went: counts by status,
    // the median and p95 time to the stored file of those that succeeded,
    // and the most common failure reasons.
    async metrics({ since, until }: { since: Date; until: Date }) {
      const db = getDb();
      const within = and(gte(table.createdAt, since), lt(table.createdAt, until));
      const status = (value: string) => sql`count(*) filter (where ${table.status} = ${value})`.mapWith(Number);
      const ms = sql`extract(epoch from ${table.completedAt} - ${table.createdAt}) * 1000`;
      const percentile = (p: number) =>
        sql<number | null>`percentile_cont(${p}) within group (order by ${ms}) filter (where ${table.status} = 'succeeded')`.mapWith(
          (value) => (value === null ? null : Math.round(Number(value))),
        );

      const [[outcomes], errors] = await Promise.all([
        db
          .select({
            total: count(),
            succeeded: status("succeeded"),
            failed: status("failed"),
            pending: status("pending"),
            medianMs: percentile(0.5),
            p95Ms: percentile(0.95),
          })
          .from(table)
          .where(within),
        db
          .select({ error: sql<string>`${table.error}`, count: count() })
          .from(table)
          .where(and(within, eq(table.status, "failed"), isNotNull(table.error)))
          .groupBy(table.error)
          .orderBy(desc(count()), table.error)
          .limit(TOP_ERRORS),
      ]);
      return { kind: name, ...outcomes, errors };
    },

    // Inserts the pending row and spends the credits in one transaction, so
    // no spend exists without a row for the sweep to find. Then runs
    // `submit`, which queues the job. If submit throws, the job fails and is
    // refunded, once. Rethrows for the caller to map.
    async start(
      { userId, id, credits }: { userId: string; id: string; credits: number },
      insert: (tx: Tx) => Promise<unknown>,
      submit: () => Promise<Row<T>>,
    ): Promise<Row<T>> {
      await getDb().transaction(async (tx) => {
        await insert(tx);
        await spendCredits({ userId, amount: credits, reason: name, idempotencyKey: `${name}:${id}`, tx });
      });
      try {
        const submitted = await submit();
        log.info(`${name}.submitted`, { id, userId, credits });
        return submitted;
      } catch (error) {
        await fail(userId, id, credits, String((error as Error)?.message ?? error));
        throw error;
      }
    },

    // Settles jobs left pending: fails and refunds those never submitted (a
    // crash) or that the provider hasn't finished by giveUpAfterMs, oldest
    // first, and collects finished ones nobody polled for. It asks about the
    // least recently checked first, so a backlog larger than a batch takes
    // turns. It works on SWEEP_CONCURRENCY jobs at a time, so a batch fits
    // the cron route's time limit. Returns how many it failed and checked.
    async sweep(now = new Date()): Promise<{ failed: number; checked: number }> {
      const db = getDb();
      const before = (ms: number) => lt(table.createdAt, new Date(now.getTime() - ms));
      const pending = eq(table.status, "pending");

      const lost = await db
        .select()
        .from(table)
        .where(
          and(
            pending,
            or(
              and(isNull(jobColumn), before(kind.stale.afterMs)),
              and(isNotNull(jobColumn), before(kind.stale.giveUpAfterMs)),
            ),
          ),
        )
        .orderBy(asc(table.createdAt))
        .limit(LOST_BATCH);
      let failed = 0;
      await eachLimited(lost, SWEEP_CONCURRENCY, (found) => {
        const job = row(found);
        // An error leaves it pending for the next run, and the rest go on.
        const reason = kind.jobId(job) ? kind.neverFinished : "Never submitted";
        return fail(job.userId, job.id, kind.credits(job), reason, { unwatched: true }).then(
          () => void failed++,
          (error) => log.error(`${name}.sweep_fail_failed`, { id: job.id, error }),
        );
      });

      const open = await db
        .select({ id: table.id, userId: table.userId })
        .from(table)
        .where(and(pending, isNotNull(jobColumn), before(kind.stale.afterMs)))
        .orderBy(sql`${table.checkedAt} asc nulls first`, desc(table.createdAt))
        .limit(kind.stale.batch);
      if (open.length > 0) {
        await db
          .update(table)
          .set({ checkedAt: now })
          .where(inArray(table.id, open.map((job) => job.id)));
      }
      await eachLimited(open, SWEEP_CONCURRENCY, (job) =>
        // A provider or storage error leaves it pending for the next run.
        refresh(job.userId, job.id, { unwatched: true }).then(
          () => {},
          (error) => log.error(`${name}.sweep_refresh_failed`, { id: job.id, error }),
        ),
      );

      return { failed, checked: open.length };
    },
  };

  async function download(url: string): Promise<Uint8Array> {
    const response = await fetch(url, { signal: AbortSignal.timeout(kind.output.timeoutMs) });
    if (!response.ok) throw kind.output.error(`Downloading the ${name} failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}
