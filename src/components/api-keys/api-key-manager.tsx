"use client";

import { Check, ChevronDown, Copy, KeyRound, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

// Mirrors listApiKeys in src/server/auth/api-keys.ts; the page passes rows
// straight through, so typecheck catches drift.
export type ApiKeyRow = {
  id: string;
  name: string;
  // The key's first characters, to tell keys apart.
  start: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
};

// Days a new key lasts, or never. 90 is preselected.
const EXPIRIES = ["30", "90", "365", "never"] as const;
type Expiry = (typeof EXPIRIES)[number];
const DAY_SECONDS = 24 * 3600;

// Better Auth's limit on key names.
const MAX_NAME_LENGTH = 32;

export function ApiKeyManager({ keys, max, appUrl }: { keys: ApiKeyRow[]; max: number; appUrl: string }) {
  const t = useTranslations("ApiKeys");
  const router = useRouter();
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<Expiry>("90");
  // Pending until the refreshed list has rendered, so the new key, the list
  // and the count change together.
  const [creating, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const full = keys.length >= max;

  function create(event: React.FormEvent) {
    event.preventDefault();
    if (full || creating || !name.trim()) return;
    setError(null);
    startTransition(async () => {
      const { data, error: failure } = await authClient.apiKey
        .create({ name: name.trim(), expiresIn: expiry === "never" ? null : Number(expiry) * DAY_SECONDS })
        .catch(() => ({ data: null, error: { code: undefined } }));
      // Updates after an await join the transition only inside startTransition.
      startTransition(() => {
        if (!data?.key) {
          setError(failure?.code === "TOO_MANY_KEYS" ? t("errors.tooMany", { max }) : t("errors.failed"));
          return;
        }
        setCreated(data.key);
        setName("");
        router.refresh();
      });
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={create} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">{t("createTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div className="grid gap-2">
            <Label htmlFor="api-key-name">{t("name")}</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_NAME_LENGTH}
              placeholder={t("namePlaceholder")}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api-key-expiry">{t("expiry")}</Label>
            <div className="relative">
              <select
                id="api-key-expiry"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value as Expiry)}
                className="h-10 w-full appearance-none rounded-lg border border-input bg-card pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {EXPIRIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`expiries.${value}`)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="submit" disabled={full || creating || !name.trim()}>
            <KeyRound />
            {creating ? t("creating") : t("create")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("count", { count: keys.length, max })}</span>
        </div>
        {full && <p className="text-sm text-muted-foreground">{t("errors.tooMany", { max })}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      {created && <CreatedKey value={created} onDone={() => setCreated(null)} />}

      <KeyTable keys={keys} />

      <section aria-labelledby="api-key-docs" className="flex flex-col gap-3">
        <h2 id="api-key-docs" className="font-display text-lg font-semibold">
          {t("docsTitle")}
        </h2>
        <p className="text-pretty text-muted-foreground">{t("docsBody")}</p>
        <pre className="overflow-x-auto rounded-xl border bg-muted p-4 font-mono text-xs leading-relaxed">
          {[
            `curl -s -X POST "${appUrl}/api/images" -H "x-api-key: $KEY" \\`,
            `  -H "content-type: application/json" -d '{"prompt":"A flower shop at dawn","aspect":"1:1"}'`,
            `curl -s "${appUrl}/api/images/<id>" -H "x-api-key: $KEY"`,
            `curl -sL "${appUrl}/api/images/<id>/download" -H "x-api-key: $KEY" -o image.png`,
          ].join("\n")}
        </pre>
      </section>
    </div>
  );
}

// The new key, shown once.
function CreatedKey({ value, onDone }: { value: string; onDone: () => void }) {
  const t = useTranslations("ApiKeys");
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
  }

  return (
    <section
      aria-labelledby="api-key-created"
      className="flex flex-col gap-3 rounded-xl border border-primary-text/30 bg-primary-text/5 p-5"
    >
      <h2 id="api-key-created" className="font-display text-lg font-semibold">
        {t("createdTitle")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("createdBody")}</p>
      <code className="rounded-lg border bg-card px-3 py-2 font-mono text-sm break-all">{value}</code>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("done")}
        </Button>
      </div>
    </section>
  );
}

function KeyTable({ keys }: { keys: ApiKeyRow[] }) {
  const t = useTranslations("ApiKeys");
  const format = useFormatter();
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium" });

  return (
    <section className="flex flex-col gap-3">
      <h2 id="api-key-list" className="font-display text-lg font-semibold">
        {t("listTitle")}
      </h2>
      {keys.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table aria-labelledby="api-key-list" className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("columns.name")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("columns.key")}</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">{t("columns.created")}</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">{t("columns.lastUsed")}</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">{t("columns.expires")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((key) => (
                <tr key={key.id}>
                  <td className="px-4 py-3 font-medium break-all">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">{key.start}…</td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground sm:table-cell">
                    {date(key.createdAt)}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground md:table-cell">
                    {key.lastUsedAt ? date(key.lastUsedAt) : t("notUsed")}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground sm:table-cell">
                    {!key.expiresAt ? t("never") : key.expiresAt < new Date() ? t("expired") : date(key.expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RevokeKey id={key.id} name={key.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RevokeKey({ id, name }: { id: string; name: string }) {
  const t = useTranslations("ApiKeys");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  // Pending until the refreshed list has rendered: the dialog closes with
  // the row already gone.
  const [saving, startTransition] = useTransition();

  function revoke() {
    setFailed(false);
    startTransition(async () => {
      const { error } = await authClient.apiKey.delete({ keyId: id }).catch(() => ({ error: true }));
      startTransition(() => {
        if (error) return setFailed(true);
        setOpen(false);
        router.refresh();
      });
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFailed(false);
      }}
    >
      <AlertDialogTrigger render={<Button variant="ghost" size="icon" />} aria-label={t("revokeLabel", { name })}>
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">{t("revokeBody", { name })}</AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {t("errors.revokeFailed")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <Button variant="destructive" onClick={revoke} disabled={saving}>
            {t("revoke")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
