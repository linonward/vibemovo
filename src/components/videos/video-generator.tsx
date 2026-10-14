"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useCredits } from "@/components/dashboard/credits";
import { PromptExamples } from "@/components/dashboard/prompt-examples";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePendingPoll } from "@/hooks/use-pending-poll";
import { Link } from "@/i18n/navigation";
import type { ApiBody, ApiErrorCode, GeneratedVideo, Serialized, VideoResponse } from "@/lib/api";
import { fitsImageLimits, type ImageLimits, limitValues } from "@/lib/image-limits";
import { VideoList } from "./video-list";

type Video = GeneratedVideo;

export type VideoGeneratorProps = {
  balance: number;
  // The provider's resolutions, lowest first, with their price.
  resolutions: { value: string; creditsPerSecond: number }[];
  // Seconds.
  durations: readonly number[];
  maxPromptLength: number;
  maxImageBytes: number;
  // The pixel sizes the provider accepts.
  imageLimits: ImageLimits;
  // False when no provider or storage is configured.
  enabled: boolean;
  videos: Video[];
};

const POLL_MS = 5000;

const EXAMPLES = ["pushIn", "wind", "turn", "timeLapse", "orbit"] as const;

const ERRORS = {
  INSUFFICIENT_CREDITS: "errors.credits",
  INVALID_REQUEST: "errors.image",
  INVALID_IMAGE_SIZE: "errors.imageSize",
  CONTENT_BLOCKED: "errors.blocked",
  MODERATION_UNAVAILABLE: "errors.moderation",
  VIDEOS_DISABLED: "disabled",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

const parse = (video: Serialized<Video>): Video => ({
  ...video,
  createdAt: new Date(video.createdAt),
});

export function VideoGenerator(props: VideoGeneratorProps) {
  const t = useTranslations("Videos");
  const [image, setImage] = useState<File | null>(null);
  // The latest pick, so a slow size check for an earlier file changes nothing.
  const picked = useRef<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(props.durations[0]);
  const [resolution, setResolution] = useState(props.resolutions[0]);
  const [balance, setBalance] = useState(props.balance);
  const adjustCredits = useCredits()?.adjust;
  const [videos, setVideos] = useState(props.videos);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost = duration * resolution.creditsPerSecond;
  const canAfford = balance >= cost;
  const examples = EXAMPLES.map((key) => ({
    label: t(`examples.${key}.label`),
    prompt: t(`examples.${key}.prompt`),
  }));
  const size = Math.round(props.maxImageBytes / 1024 / 1024);
  const messageValues = { size, ...limitValues(props.imageLimits) };
  const pendingIds = videos.filter((video) => video.status === "pending").map((video) => video.id);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

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

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (file && file.size > props.maxImageBytes) {
      setImage(null);
      setPreview(null);
      setError(t("errors.image", { size }));
      return;
    }
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : null);
    picked.current = file;
    if (!file) return;
    void fitsImageLimits(file, props.imageLimits).then((fits) => {
      if (fits !== false || picked.current !== file) return;
      picked.current = null;
      setImage(null);
      setPreview(null);
      setError(t("errors.imageSize", messageValues));
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!image) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.set("prompt", prompt);
    form.set("duration", String(duration));
    form.set("resolution", resolution.value);
    form.set("image", image);
    const response = await fetch("/api/videos", { method: "POST", body: form }).catch(() => null);
    const body: ApiBody<VideoResponse> = response ? await response.json().catch(() => ({})) : {};
    setSubmitting(false);

    const { video } = body;
    if (response?.ok && video) {
      setVideos((current) => [parse(video), ...current]);
      setBalance((current) => current - cost);
      adjustCredits?.(-cost);
      return;
    }
    setError(t(ERRORS[body.error as keyof typeof ERRORS] ?? "errors.failed", messageValues));
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl border bg-card p-5">
        {!props.enabled && <p className="text-muted-foreground">{t("disabled")}</p>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="video-image">{t("startImage")}</Label>
          <input
            id="video-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={pick}
            aria-describedby="video-image-hint"
            className="w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <p id="video-image-hint" className="text-sm text-muted-foreground">
            {t("imageHint", { size })}
          </p>
          {preview && (
            // A local object URL, which next/image can't optimize.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={t("preview")}
              className="max-h-64 w-fit max-w-full rounded-lg border bg-muted object-contain"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="video-prompt">{t("prompt")}</Label>
          <textarea
            id="video-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={props.maxPromptLength}
            rows={3}
            placeholder={t("placeholder")}
            className="w-full min-w-0 resize-y rounded-lg border border-input bg-card px-3 py-2 text-base transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
          <PromptExamples examples={examples} onPick={setPrompt} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("duration")}</legend>
          <div className="flex flex-wrap gap-2">
            {props.durations.map((value) => (
              <label
                key={value}
                className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-[background-color,border-color] duration-150 has-checked:border-foreground has-checked:bg-muted has-focus-visible:outline-2 has-focus-visible:outline-ring"
              >
                <input
                  type="radio"
                  name="duration"
                  value={value}
                  checked={duration === value}
                  onChange={() => setDuration(value)}
                  className="sr-only"
                />
                {t("seconds", { count: value })}
              </label>
            ))}
          </div>
        </fieldset>

        {props.resolutions.length > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("resolution")}</legend>
            <div className="flex flex-wrap gap-2">
              {props.resolutions.map((option) => (
                <label
                  key={option.value}
                  className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-[background-color,border-color] duration-150 has-checked:border-foreground has-checked:bg-muted has-focus-visible:outline-2 has-focus-visible:outline-ring"
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={option.value}
                    checked={resolution.value === option.value}
                    onChange={() => setResolution(option)}
                    className="sr-only"
                  />
                  {option.value}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            type="submit"
            disabled={!props.enabled || !canAfford || submitting || !image || prompt.trim() === ""}
          >
            <Sparkles />
            {submitting ? t("generating") : t("generate", { count: cost })}
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
          <h2 id="videos-title" className="font-display text-lg font-semibold">
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
          <VideoList videos={videos} aria-labelledby="videos-title" />
        )}
      </section>
    </div>
  );
}
