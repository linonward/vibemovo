"use client";

import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EFFECT_KINDS } from "@/components/videos/effect-generator";
import { type Side, usePhotoPicks } from "@/components/videos/use-photo-picks";
import { Link, useRouter } from "@/i18n/navigation";
import type { ApiBody, ApiErrorCode, VideoResponse } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { type ImageLimits, limitValues } from "@/lib/image-limits";
import { clearPhotoDraft, loadPhotoDraft, type PhotoDraft, savePhotoDraft } from "@/lib/photo-draft";

// Each landing page's route and photos, sent as image1 and image2 in this
// order. The rap duo also sends a name per photo and the page's language.
const KINDS = {
  zombie: EFFECT_KINDS.zombie,
  hug: EFFECT_KINDS.hug,
  vampire: EFFECT_KINDS.vampire,
  rap: { endpoint: "/api/videos/rap", sides: ["left", "right"] },
} as const satisfies Record<string, { endpoint: string; sides: readonly Side[] }>;

export type LandingTryoutProps = {
  kind: keyof typeof KINDS;
  // The fixed price of one video.
  credits: number;
  signup: number;
  // Per photo.
  maxImageBytes: number;
  imageLimits: ImageLimits;
  // For kind "rap".
  maxNameLength?: number;
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

// A video's form on its landing page, for visitors signed in or not. A
// signed-out visitor picks photos and signs in from a dialog; the photos
// wait in the browser and go out when sign-in brings them back here. Once
// sent, the tool page shows the video as it renders.
export function LandingTryout(props: LandingTryoutProps) {
  const { endpoint, sides } = KINDS[props.kind];
  const withNames = props.kind === "rap";
  const tool = `/videos/${props.kind}`;
  const draftKey = `landing:${props.kind}`;
  // Literal names, so the client messages test can check them.
  const messages = {
    zombie: useTranslations("ZombieVideos"),
    hug: useTranslations("HugVideos"),
    vampire: useTranslations("VampireVideos"),
    rap: useTranslations("RapVideos"),
  };
  const t = messages[props.kind] as typeof messages.zombie;
  const locale = useLocale();
  const tt = useTranslations("LandingTryout");
  const router = useRouter();
  const session = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signIn, setSignIn] = useState<string | null>(null);
  const [names, setNames] = useState<Record<Side, string>>({ left: "", right: "" });
  // The draft restored after sign-in, sent once the session is known.
  const [resume, setResume] = useState<PhotoDraft | null>(null);
  const resumed = useRef(false);

  const size = Math.round(props.maxImageBytes / 1024 / 1024);
  const { min, max: maxSide, ratio } = limitValues(props.imageLimits);
  const messageValues = { size, max: props.maxNameLength ?? 0, min, maxSide, ratio };
  const { photos, previews, pick } = usePhotoPicks({
    maxImageBytes: props.maxImageBytes,
    imageLimits: props.imageLimits,
    onError: (key) => {
      setNoCredits(false);
      setError(key && t(`errors.${key}`, messageValues));
    },
  });
  const ready = sides.every((side) => photos[side] && (!withNames || names[side].trim()));

  async function send(draft: PhotoDraft) {
    setSubmitting(true);
    setError(null);
    setNoCredits(false);
    const form = new FormData();
    draft.photos.forEach((file, index) => form.set(`image${index + 1}`, file));
    if (withNames) {
      sides.forEach((side, index) => form.set(`name${index + 1}`, draft.fields[side] ?? ""));
      form.set("language", locale);
    }
    const response = await fetch(endpoint, { method: "POST", body: form }).catch(() => null);
    const body: ApiBody<VideoResponse> = response ? await response.json().catch(() => ({})) : {};

    if (response?.ok && body.video) {
      await clearPhotoDraft(draftKey);
      router.push(tool);
      return;
    }
    setSubmitting(false);
    if (response?.status === 401) return askToSignIn(draft);
    if (body.error === "INSUFFICIENT_CREDITS") return setNoCredits(true);
    setError(t(ERRORS[body.error as keyof typeof ERRORS] ?? "errors.failed", messageValues));
  }

  async function askToSignIn(draft: PhotoDraft) {
    await savePhotoDraft(draftKey, draft);
    const url = new URL(window.location.href);
    url.searchParams.set(RESUME, "1");
    setSignIn(url.pathname + url.search);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RESUME)) return;
    url.searchParams.delete(RESUME);
    window.history.replaceState(null, "", url);
    void loadPhotoDraft(draftKey).then((draft) => {
      if (!draft || draft.photos.length !== sides.length) return;
      draft.photos.forEach((file, index) => pick(sides[index], file));
      if (withNames) setNames({ left: draft.fields.left ?? "", right: draft.fields.right ?? "" });
      setResume(draft);
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
    const draft = {
      photos: sides.map((side) => photos[side] as File),
      fields: withNames ? { ...names } : {},
    };
    if (session.data) void send(draft);
    else void askToSignIn(draft);
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
              {withNames && (
                <>
                  <Label htmlFor={`try-${props.kind}-${side}-name`} className="mt-2">
                    {messages.rap(`${side}.name`)}
                  </Label>
                  <Input
                    id={`try-${props.kind}-${side}-name`}
                    value={names[side]}
                    onChange={(event) => setNames((current) => ({ ...current, [side]: event.target.value }))}
                    maxLength={props.maxNameLength}
                    autoComplete="off"
                  />
                </>
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
