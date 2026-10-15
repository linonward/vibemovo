"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EFFECT_KINDS } from "@/components/videos/effect-generator";
import { usePhotoPicks } from "@/components/videos/use-photo-picks";
import { Link, useRouter } from "@/i18n/navigation";
import type { ApiBody, ApiErrorCode, VideoResponse } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { type ImageLimits, limitValues } from "@/lib/image-limits";
import { clearPhotoDraft, loadPhotoDraft, savePhotoDraft } from "@/lib/photo-draft";

export type LandingTryoutProps = {
  kind: "zombie" | "hug" | "vampire";
  // The fixed price of one video.
  credits: number;
  signup: number;
  // Per photo.
  maxImageBytes: number;
  imageLimits: ImageLimits;
};

// Sign-in returns with it, so the page sends the saved photos.
const RESUME = "try";

const ERRORS = {
  INVALID_REQUEST: "errors.invalid",
  INVALID_IMAGE_SIZE: "errors.imageSize",
  CONTENT_BLOCKED: "errors.blocked",
  MODERATION_UNAVAILABLE: "errors.moderation",
  VIDEOS_DISABLED: "disabled",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

// The effect's form on its landing page, for visitors signed in or not. A
// signed-out visitor picks photos and signs in from a dialog; the photos
// wait in the browser and go out when sign-in brings them back here. Once
// sent, the tool page shows the video as it renders.
export function LandingTryout(props: LandingTryoutProps) {
  const { endpoint, sides } = EFFECT_KINDS[props.kind];
  const tool = `/videos/${props.kind}`;
  const draftKey = `landing:${props.kind}`;
  // Literal names, so the client messages test can check them.
  const messages = {
    zombie: useTranslations("ZombieVideos"),
    hug: useTranslations("HugVideos"),
    vampire: useTranslations("VampireVideos"),
  };
  const t = messages[props.kind] as typeof messages.zombie;
  const tt = useTranslations("LandingTryout");
  const router = useRouter();
  const session = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signIn, setSignIn] = useState<string | null>(null);
  // Photos restored after sign-in, sent once the session is known.
  const [resume, setResume] = useState<File[] | null>(null);
  const resumed = useRef(false);

  const size = Math.round(props.maxImageBytes / 1024 / 1024);
  const { min, max: maxSide, ratio } = limitValues(props.imageLimits);
  const messageValues = { size, min, maxSide, ratio };
  const { photos, previews, pick } = usePhotoPicks({
    maxImageBytes: props.maxImageBytes,
    imageLimits: props.imageLimits,
    onError: (key) => {
      setNoCredits(false);
      setError(key && t(`errors.${key}`, messageValues));
    },
  });
  const ready = sides.every((side) => photos[side]);

  async function send(files: File[]) {
    setSubmitting(true);
    setError(null);
    setNoCredits(false);
    const form = new FormData();
    files.forEach((file, index) => form.set(`image${index + 1}`, file));
    const response = await fetch(endpoint, { method: "POST", body: form }).catch(() => null);
    const body: ApiBody<VideoResponse> = response ? await response.json().catch(() => ({})) : {};

    if (response?.ok && body.video) {
      await clearPhotoDraft(draftKey);
      router.push(tool);
      return;
    }
    setSubmitting(false);
    if (response?.status === 401) return askToSignIn(files);
    if (body.error === "INSUFFICIENT_CREDITS") return setNoCredits(true);
    setError(t(ERRORS[body.error as keyof typeof ERRORS] ?? "errors.failed", messageValues));
  }

  async function askToSignIn(files: File[]) {
    await savePhotoDraft(draftKey, files);
    const url = new URL(window.location.href);
    url.searchParams.set(RESUME, "1");
    setSignIn(url.pathname + url.search);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RESUME)) return;
    url.searchParams.delete(RESUME);
    window.history.replaceState(null, "", url);
    void loadPhotoDraft(draftKey).then((files) => {
      if (!files || files.length !== sides.length) return;
      files.forEach((file, index) => pick(sides[index], file));
      setResume(files);
    });
    // Once, on the page sign-in returned to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!resume || resumed.current || session.isPending || !session.data) return;
    resumed.current = true;
    void send(resume);
    // send reads only props and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, session.isPending, session.data]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const files = sides.map((side) => photos[side] as File);
    if (session.data) void send(files);
    else void askToSignIn(files);
  }

  return (
    <section
      id="try"
      aria-labelledby={`${props.kind}-try`}
      className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${props.kind}-try`} className="font-display text-lg font-semibold">
          {tt("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{tt("body")}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className={sides.length > 1 ? "grid gap-5 sm:grid-cols-2" : "grid gap-5"}>
          {sides.map((side) => (
            <div key={side} className="flex flex-col gap-2">
              <Label htmlFor={`try-${props.kind}-${side}`}>{t(`${side}.photo`)}</Label>
              <input
                id={`try-${props.kind}-${side}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => pick(side, event.target.files?.[0] ?? null)}
                aria-describedby={`try-${props.kind}-hint`}
                className="w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
              {previews[side] && (
                // A local object URL, which next/image can't optimize.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[side]}
                  alt={t(`${side}.preview`)}
                  className="max-h-48 w-fit max-w-full rounded-lg border bg-muted object-contain"
                />
              )}
            </div>
          ))}
        </div>
        <p id={`try-${props.kind}-hint`} className="text-sm text-muted-foreground">
          {t("photoHint", { size })}
        </p>
        <Button type="submit" size="lg" className="self-start" disabled={!ready || submitting}>
          <Sparkles />
          {submitting ? t("generating") : t("generate", { count: props.credits })}
        </Button>
        {(error || noCredits) && (
          <p role="alert" className="text-sm text-destructive">
            {noCredits ? tt("credits") : error}{" "}
            {noCredits && (
              <Link href="/pricing" className="font-medium underline underline-offset-4">
                {tt("buyCredits")}
              </Link>
            )}
          </p>
        )}
      </form>

      <Dialog open={signIn !== null} onOpenChange={(open) => !open && setSignIn(null)}>
        <DialogContent closeLabel={tt("close")}>
          <DialogHeader>
            <DialogTitle>{tt("signIn.title")}</DialogTitle>
            <DialogDescription>{tt("signIn.body", { signup: props.signup })}</DialogDescription>
          </DialogHeader>
          {signIn && (
            <LoginForm returnTo={signIn} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
