import { ArrowLeft, Clapperboard, Download } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { GeneratedVideo } from "@/lib/api";

export function VideoDetail({ video }: { video: GeneratedVideo }) {
  const t = useTranslations("Videos");
  const format = useFormatter();

  const fields = [
    { label: t("prompt"), value: <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{video.prompt}</span> },
    { label: t("duration"), value: t("seconds", { count: video.duration }) },
    { label: t("resolution"), value: video.resolution },
    { label: t("spent"), value: t("credits", { count: video.credits }) },
    { label: t("status"), value: t(`statuses.${video.status}`) },
    { label: t("created"), value: format.dateTime(video.createdAt, { dateStyle: "medium", timeStyle: "short" }) },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href="/videos/library"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("libraryTitle")}
        </Link>
        <PageHeader title={t("detailTitle")} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-xl border bg-muted">
          {video.url ? (
            // No fixed ratio: the player takes the video's own once its
            // metadata loads, so no strip of background shows beside it.
            <video
              src={video.url}
              poster={video.posterUrl ?? video.imageUrl ?? undefined}
              aria-label={video.prompt}
              controls
              playsInline
              preload="metadata"
              className="mx-auto max-h-[75svh] w-full"
            />
          ) : (
            <div
              className="flex aspect-video w-full items-center justify-center bg-cover bg-center p-6 text-center text-sm text-muted-foreground"
              style={video.imageUrl ? { backgroundImage: `url(${video.imageUrl})` } : undefined}
            >
              <span className="flex items-center gap-2 rounded-lg bg-background/90 px-3 py-1.5">
                <Clapperboard className="size-4 shrink-0" />
                {t(video.status === "failed" ? "failed" : "pending")}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <dl className="flex flex-col gap-3 rounded-xl border bg-card p-5 text-sm">
            {fields.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {video.imageUrl && (
              <div className="flex flex-col gap-2">
                <dt className="text-muted-foreground">{t("startImage")}</dt>
                <dd>
                  {/* Signed URLs change every hour, so next/image's cache wouldn't help. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={video.imageUrl}
                    alt={t("startImage")}
                    className="max-h-40 w-auto max-w-full rounded-lg border object-contain"
                  />
                </dd>
              </div>
            )}
          </dl>
          {video.url && (
            // The route answers with a file, so the browser stays on this page.
            <a href={`/api/videos/${video.id}/download`} download className={buttonVariants()}>
              <Download />
              {t("download")}
            </a>
          )}
        </div>
      </div>
    </>
  );
}
