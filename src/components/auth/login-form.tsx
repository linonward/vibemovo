"use client";

import { LoaderCircle, Mail, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { signInReturnPath } from "@/lib/sign-in";
import { Turnstile } from "./turnstile";

type State = "idle" | "sending" | "sent" | "error" | "google-error";

// With a Turnstile site key, a magic link waits for the challenge and
// sends its token; the server rejects magic-link requests without one.
// `returnTo` is for a form outside /sign-in, which has no ?next=: a dialog
// returns to the page that opened it.
export function LoginForm({ turnstileSiteKey, returnTo }: { turnstileSiteKey?: string; returnTo?: string }) {
  const t = useTranslations("LoginForm");
  const locale = useLocale();
  const [state, setState] = useState<State>("idle");
  const [token, setToken] = useState<string | null>(null);
  // Bumped to remount the widget: a token works once.
  const [challenge, setChallenge] = useState(0);

  // Read at submit, not render, so the page needs no Suspense boundary.
  const callbackURL = () =>
    signInReturnPath(returnTo ?? new URLSearchParams(window.location.search).get("next"), locale);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const email = String(new FormData(event.currentTarget).get("email"));
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: callbackURL(),
      fetchOptions: { headers: token ? { "x-captcha-response": token } : {} },
    });
    setState(error ? "error" : "sent");
    if (error && turnstileSiteKey) {
      setToken(null);
      setChallenge((n) => n + 1);
    }
  }

  async function onGoogle() {
    setState("sending");
    // On success the browser navigates to Google, so only errors land here.
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackURL(),
    });
    if (error) setState("google-error");
  }

  if (state === "sent") {
    return (
      <p role="status" className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-primary-text" />
        {t("sent")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={state === "sending"}
        onClick={onGoogle}
      >
        {t("google")}
      </Button>
      {state === "google-error" && (
        <p role="alert" className="text-sm text-destructive">
          {t("googleError")}
        </p>
      )}
      <p className="flex items-center gap-3 text-sm text-muted-foreground">
        <span aria-hidden className="h-px flex-1 bg-border" />
        {t("or")}
        <span aria-hidden className="h-px flex-1 bg-border" />
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        {turnstileSiteKey && <Turnstile key={challenge} siteKey={turnstileSiteKey} onToken={setToken} />}
        <Button
          type="submit"
          size="lg"
          disabled={state === "sending" || Boolean(turnstileSiteKey && !token)}
        >
          {/* Both icons stay mounted and cross-fade, so the label never shifts. */}
          <span className="relative size-4">
            <Mail
              className={`icon-swap absolute inset-0 ${state === "sending" ? "scale-50 opacity-0" : ""}`}
            />
            <LoaderCircle
              className={`icon-swap absolute inset-0 animate-spin ${state === "sending" ? "" : "scale-50 opacity-0"}`}
            />
          </span>
          {t("send")}
        </Button>
        {state === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {t("sendError")}
          </p>
        )}
      </form>
    </div>
  );
}
