import { ArrowLeft, Download, ImageIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { GeneratedImage } from "@/lib/api";
import { ImageViewer } from "./image-viewer";

export function ImageDetail({ image }: { image: GeneratedImage }) {
  const t = useTranslations("Images");
  const format = useFormatter();

  const fields = [
    { label: t("prompt"), value: <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{image.prompt}</span> },
    { label: t("aspect"), value: <span className="tabular-nums">{image.aspect}</span> },
    { label: t("status"), value: t(`statuses.${image.status}`) },
    { label: t("created"), value: format.dateTime(image.createdAt, { dateStyle: "medium", timeStyle: "short" }) },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href="/images/library"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("libraryTitle")}
        </Link>
        <PageHeader title={t("detailTitle")} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-xl border bg-muted">
          {image.url ? (
            <ImageViewer image={{ id: image.id, prompt: image.prompt, url: image.url }}>
              {/* Signed URLs change every hour, so next/image's cache wouldn't help. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.prompt}
                className="mx-auto max-h-[75svh] w-auto max-w-full object-contain"
                style={{ aspectRatio: `auto ${image.aspect.replace(":", " / ")}` }}
              />
            </ImageViewer>
          ) : (
            <div
              className="mx-auto flex max-h-[75svh] w-full items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground"
              style={{ aspectRatio: image.aspect.replace(":", " / ") }}
            >
              <ImageIcon className="size-4 shrink-0" />
              {t(image.status === "failed" ? "failed" : "pending")}
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
          </dl>
          {image.url && (
            // The route answers with a file, so the browser stays on this page.
            <a href={`/api/images/${image.id}/download`} download className={buttonVariants()}>
              <Download />
              {t("download")}
            </a>
          )}
        </div>
      </div>
    </>
  );
}
