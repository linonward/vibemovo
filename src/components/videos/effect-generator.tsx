"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCreditBalance } from "@/components/dashboard/credits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePendingPoll } from "@/hooks/use-pending-poll";
import { Link } from "@/i18n/navigation";
import type { ApiBody, ApiErrorCode, GeneratedVideo, Serialized, VideoResponse } from "@/lib/api";
import { type ImageLimits, limitValues } from "@/lib/image-limits";
import { PHOTO_EFFECT_KINDS, type PhotoEffectKind } from "@/lib/photo-effects";
import { useEffectMessages } from "./effect-messages";
import { type Side, usePhotoPicks } from "./use-photo-picks";
import { VideoList } from "./video-list";

type Video = GeneratedVideo;

// A photo effect's photos, sent as image1 and image2 in this order.
export function effectSides(photos: 1 | 2): readonly Side[] {
  return photos === 2 ? ["left", "right"] : ["left"];
}

export type EffectKind = PhotoEffectKind | "object";

// The object effects, as ObjectVideos.effects names them. The page passes
// the server's list, so an effect without copy fails the typecheck.
export type ObjectEffect = "squish" | "inflate" | "cake";

export type EffectGeneratorProps = {
  kind: EffectKind;
  balance: number;
  // The fixed price of one video.
  credits: number;
  // Per photo.
  maxImageBytes: number;
  // The pixel sizes Bailian accepts, per photo.
  imageLimits: ImageLimits;
  // False without Bailian or storage.
  enabled: boolean;
  // For kind "object": the effects to choose from, sent as "effect".
  effects?: readonly ObjectEffect[];
  videos: Video[];
};

const POLL_MS = 5000;

const ERRORS = {
  INSUFFICIENT_CREDITS: "errors.credits",
  INVALID_REQUEST: "errors.invalid",
  INVALID_IMAGE_SIZE: "errors.imageSize",
  CONTENT_BLOCKED: "errors.blocked",
  MODERATION_UNAVAILABLE: "errors.moderation",
  VIDEOS_DISABLED: "disabled",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

const parse = (video: Serialized<Video>): Video => ({ ...video, createdAt: new Date(video.createdAt) });

export function EffectGenerator(props: EffectGeneratorProps) {
  // Object effects post to one route, with the effect's name.
  const endpoint = props.kind === "object" ? "/api/videos/effects" : `/api/videos/${props.kind}`;
  const sides = effectSides(props.kind === "object" ? 1 : PHOTO_EFFECT_KINDS[props.kind].photos);
  // A one-photo effect has no "right" copy; it never reads it, having no
  // right side.
  const t = useEffectMessages(props.kind);
  const objectMessages = useTranslations("ObjectVideos");
  const { balance, adjust: adjustCredits } = useCreditBalance(props.balance);
  const [videos, setVideos] = useState(props.videos);
  const [submitting, setSubmitting] = useState(false);
  const [effect, setEffect] = useState(props.effects?.[0]);
  const [error, setError] = useState<string | null>(null);

  const canAfford = balance >= props.credits;
  const size = Math.round(props.maxImageBytes / 1024 / 1024);
  const { min, max: maxSide, ratio } = limitValues(props.imageLimits);
  const messageValues = { size, min, maxSide, ratio };
  const { photos, previews, pick } = usePhotoPicks({
    maxImageBytes: props.maxImageBytes,
    imageLimits: props.imageLimits,
    onError: (key) => setError(key && t(`errors.${key}`, messageValues)),
  });
  const ready = sides.every((side) => photos[side]);
  const pendingIds = videos.filter((video) => video.status === "pending").map((video) => video.id);

  // A failure was refunded on the server, so the balance gets the credits back.
  usePendingPoll({
    ids: pendingIds,
    intervalMs: POLL_MS,
    url: (id) => `/api/videos/${id}`,
    onBody: (id, body) => {
      const { video } = body as ApiBody<VideoResponse>;
      if (!video || video.status === "pending") return;
      const updated = parse(video);
      setVideos((current) => current.map((item) => (item.id === id ? updated : item)));
      if (updated.status === "failed") {
        adjustCredits(updated.credits, `video-refund:${id}`);
      }
    },
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    sides.forEach((side, index) => form.set(`image${index + 1}`, photos[side] as File));
    if (effect) form.set("effect", effect);
    const response = await fetch(endpoint, { method: "POST", body: form }).catch(() => null);
    const body: ApiBody<VideoResponse> = response ? await response.json().catch(() => ({})) : {};
    setSubmitting(false);

    const { video } = body;
    if (response?.ok && video) {
      setVideos((current) => [parse(video), ...current]);
      adjustCredits(-props.credits, `video:${video.id}`);
      return;
    }
    setError(t(ERRORS[body.error as keyof typeof ERRORS] ?? "errors.failed", messageValues));
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl border bg-card p-5">
        {!props.enabled && <p className="text-muted-foreground">{t("disabled")}</p>}
        <div className={sides.length > 1 ? "grid gap-5 sm:grid-cols-2" : "grid gap-5"}>
          {sides.map((side) => (
            <div key={side} className="flex flex-col gap-2">
              <Label htmlFor={`${props.kind}-${side}-photo`}>{t(`${side}.photo`)}</Label>
              <input
                id={`${props.kind}-${side}-photo`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => pick(side, event.target.files?.[0] ?? null)}
                aria-describedby={`${props.kind}-photo-hint`}
                className="w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
              {previews[side] && (
                // A local object URL, which next/image can't optimize.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[side]}
                  alt={t(`${side}.preview`)}
                  className="max-h-64 w-fit max-w-full rounded-lg border bg-muted object-contain"
                />
              )}
            </div>
          ))}
        </div>
        <p id={`${props.kind}-photo-hint`} className="text-sm text-muted-foreground">
          {t("photoHint", { size })}
        </p>

        {props.effects && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{objectMessages("effect")}</legend>
            <div className="flex flex-wrap gap-2">
              {props.effects.map((value) => (
                <label
                  key={value}
                  className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-[background-color,border-color] duration-150 has-checked:border-foreground has-checked:bg-muted has-focus-visible:outline-2 has-focus-visible:outline-ring"
                >
                  <input
                    type="radio"
                    name="effect"
                    value={value}
                    checked={effect === value}
                    onChange={() => setEffect(value)}
                    className="sr-only"
                  />
                  {objectMessages(`effects.${value}`)}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="submit" disabled={!props.enabled || !canAfford || submitting || !ready}>
            <Sparkles />
            {submitting ? t("generating") : t("generate", { count: props.credits })}
          </Button>
          <span className="text-sm text-muted-foreground">{t("balance", { count: balance })}</span>
          {!canAfford && (
            <Link href="/billing" className="text-sm underline underline-offset-4">
              {t("buyCredits")}
            </Link>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id={`${props.kind}-videos-title`} className="font-display text-lg font-semibold">
            {t("historyTitle")}
          </h2>
          {videos.length > 0 && (
            <Link href="/videos/library" className="text-sm underline underline-offset-4">
              {t("viewAll")}
            </Link>
          )}
        </div>
        {videos.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <VideoList videos={videos} aria-labelledby={`${props.kind}-videos-title`} />
        )}
      </section>
    </div>
  );
}
