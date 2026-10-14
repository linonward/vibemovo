"use client";

import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useCredits } from "@/components/dashboard/credits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePendingPoll } from "@/hooks/use-pending-poll";
import { Link } from "@/i18n/navigation";
import type { ApiBody, ApiErrorCode, GeneratedVideo, Serialized, VideoResponse } from "@/lib/api";
import { fitsImageLimits, type ImageLimits, limitValues } from "@/lib/image-limits";
import { VideoList } from "./video-list";

type Video = GeneratedVideo;

export type RapGeneratorProps = {
  balance: number;
  // The fixed price of one rap video.
  credits: number;
  // Per photo.
  maxImageBytes: number;
  maxNameLength: number;
  // The pixel sizes Bailian accepts, per photo.
  imageLimits: ImageLimits;
  // False without Bailian or storage.
  enabled: boolean;
  videos: Video[];
};

const POLL_MS = 5000;

// 图1 stands on the left, 图2 on the right.
const SIDES = ["left", "right"] as const;
type Side = (typeof SIDES)[number];

const ERRORS = {
  INSUFFICIENT_CREDITS: "errors.credits",
  INVALID_REQUEST: "errors.invalid",
  INVALID_IMAGE_SIZE: "errors.imageSize",
  CONTENT_BLOCKED: "errors.blocked",
  MODERATION_UNAVAILABLE: "errors.moderation",
  VIDEOS_DISABLED: "disabled",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

const parse = (video: Serialized<Video>): Video => ({ ...video, createdAt: new Date(video.createdAt) });

export function RapGenerator(props: RapGeneratorProps) {
  const t = useTranslations("RapVideos");
  const locale = useLocale();
  const [photos, setPhotos] = useState<Record<Side, File | null>>({ left: null, right: null });
  const [previews, setPreviews] = useState<Record<Side, string | null>>({ left: null, right: null });
  // The latest pick per side, so a slow size check for an earlier file changes nothing.
  const picked = useRef<Record<Side, File | null>>({ left: null, right: null });
  const [names, setNames] = useState<Record<Side, string>>({ left: "", right: "" });
  const [balance, setBalance] = useState(props.balance);
  const adjustCredits = useCredits()?.adjust;
  const [videos, setVideos] = useState(props.videos);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAfford = balance >= props.credits;
  const size = Math.round(props.maxImageBytes / 1024 / 1024);
  const { min, max: maxSide, ratio } = limitValues(props.imageLimits);
  const messageValues = { size, max: props.maxNameLength, min, maxSide, ratio };
  const ready = SIDES.every((side) => photos[side] && names[side].trim());
  const pendingIds = videos.filter((video) => video.status === "pending").map((video) => video.id);

  useEffect(
    () => () => {
      for (const url of Object.values(previews)) if (url) URL.revokeObjectURL(url);
    },
    [previews],
  );

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
        setBalance((current) => current + updated.credits);
        adjustCredits?.(updated.credits);
      }
    },
  });

  function pick(side: Side, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    const tooBig = file !== null && file.size > props.maxImageBytes;
    if (tooBig) setError(t("errors.invalid", messageValues));
    setPhotos((current) => ({ ...current, [side]: tooBig ? null : file }));
    setPreviews((current) => ({ ...current, [side]: file && !tooBig ? URL.createObjectURL(file) : null }));
    picked.current[side] = tooBig ? null : file;
    if (!file || tooBig) return;
    void fitsImageLimits(file, props.imageLimits).then((fits) => {
      if (fits !== false || picked.current[side] !== file) return;
      picked.current[side] = null;
      setPhotos((current) => ({ ...current, [side]: null }));
      setPreviews((current) => ({ ...current, [side]: null }));
      setError(t("errors.imageSize", messageValues));
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!photos.left || !photos.right) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.set("image1", photos.left);
    form.set("image2", photos.right);
    form.set("name1", names.left);
    form.set("name2", names.right);
    form.set("language", locale);
    const response = await fetch("/api/videos/rap", { method: "POST", body: form }).catch(() => null);
    const body: ApiBody<VideoResponse> = response ? await response.json().catch(() => ({})) : {};
    setSubmitting(false);

    const { video } = body;
    if (response?.ok && video) {
      setVideos((current) => [parse(video), ...current]);
      setBalance((current) => current - props.credits);
      adjustCredits?.(-props.credits);
      return;
    }
    setError(t(ERRORS[body.error as keyof typeof ERRORS] ?? "errors.failed", messageValues));
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl border bg-card p-5">
        {!props.enabled && <p className="text-muted-foreground">{t("disabled")}</p>}
        <div className="grid gap-5 sm:grid-cols-2">
          {SIDES.map((side) => (
            <div key={side} className="flex flex-col gap-2">
              <Label htmlFor={`rap-${side}-photo`}>{t(`${side}.photo`)}</Label>
              <input
                id={`rap-${side}-photo`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => pick(side, event)}
                aria-describedby="rap-photo-hint"
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
              <Label htmlFor={`rap-${side}-name`} className="mt-2">
                {t(`${side}.name`)}
              </Label>
              <Input
                id={`rap-${side}-name`}
                value={names[side]}
                onChange={(event) => setNames((current) => ({ ...current, [side]: event.target.value }))}
                maxLength={props.maxNameLength}
                autoComplete="off"
              />
            </div>
          ))}
        </div>
        <p id="rap-photo-hint" className="text-sm text-muted-foreground">
          {t("photoHint", { size })}
        </p>

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
          <h2 id="rap-videos-title" className="font-display text-lg font-semibold">
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
          <VideoList videos={videos} aria-labelledby="rap-videos-title" />
        )}
      </section>
    </div>
  );
}
