"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import type { ApiBody, ApiErrorCode, BroadcastResponse } from "@/lib/api";

type Audience = "all" | "one";
type State = { kind: "idle" | "sending" } | { kind: "sent"; recipients: number } | { kind: "error"; code?: ApiErrorCode };

const FIELD =
  "w-full min-w-0 resize-y rounded-lg border border-input bg-card px-3 py-2 text-base transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";
const CHOICE =
  "cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-[background-color,border-color] duration-150 has-checked:border-foreground has-checked:bg-muted has-focus-visible:outline-2 has-focus-visible:outline-ring";

// Writes a notification and sends it after a confirmation. One request ID
// per confirmed form, so a double click or a retry sends once.
export function BroadcastForm({ maxTitle, maxBody }: { maxTitle: number; maxBody: number }) {
  const t = useTranslations("Admin.broadcasts");
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("all");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const valid = title.trim() && body.trim() && (audience === "all" || email.trim());

  function review(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setRequestId(crypto.randomUUID());
    setConfirming(true);
  }

  async function send() {
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    const response = await fetch("/api/admin/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, email: audience === "one" ? email : undefined, requestId }),
    }).catch(() => null);
    const json: ApiBody<BroadcastResponse> = response ? await response.json().catch(() => ({})) : {};
    setConfirming(false);
    if (!response?.ok || !json.broadcast) return setState({ kind: "error", code: json.error });
    setState({ kind: "sent", recipients: json.broadcast.recipients });
    setTitle("");
    setBody("");
    setEmail("");
    router.refresh();
  }

  return (
    <section aria-labelledby="broadcast-form-title" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <h2 id="broadcast-form-title" className="text-lg font-bold">
        {t("formTitle")}
      </h2>
      <form onSubmit={review} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("audience")}</legend>
          <div className="flex flex-wrap gap-2">
            {(["all", "one"] as const).map((value) => (
              <label key={value} className={CHOICE}>
                <input
                  type="radio"
                  name="audience"
                  value={value}
                  checked={audience === value}
                  onChange={() => setAudience(value)}
                  className="sr-only"
                />
                {t(value === "all" ? "everyone" : "oneUser")}
              </label>
            ))}
          </div>
        </fieldset>
        {audience === "one" && (
          <div className="grid gap-2">
            <Label htmlFor="broadcast-email">{t("email")}</Label>
            <Input
              id="broadcast-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="broadcast-title">{t("titleLabel")}</Label>
          <Input
            id="broadcast-title"
            required
            maxLength={maxTitle}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="broadcast-body">{t("bodyLabel")}</Label>
          <textarea
            id="broadcast-body"
            required
            rows={4}
            maxLength={maxBody}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={FIELD}
          />
        </div>
        {state.kind === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {t(state.code === "UNKNOWN_USER" ? "unknownUser" : "error")}
          </p>
        )}
        {state.kind === "sent" && (
          <p role="status" className="text-sm text-primary-text">
            {t("sent", { count: state.recipients })}
          </p>
        )}
        <Button type="submit" className="self-start" disabled={!valid}>
          {t("send")}
        </Button>
      </form>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-pretty [overflow-wrap:anywhere]">
              {audience === "all" ? t("confirmEveryone") : t("confirmOne", { email: email.trim() })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button onClick={send} disabled={state.kind === "sending"}>
              {t("confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
