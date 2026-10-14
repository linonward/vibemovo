import { Download, ImageIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { GeneratedImage } from "@/lib/api";
import { ImageViewer } from "./image-viewer";

// Columns, not a grid: each card keeps its image's height instead of
// stretching to the tallest card in its row. The prompt links to the
// image's page and stretches over the card; the image (full screen) and the
// download link sit above it.
export function ImageList({
  images,
  ...props
}: { images: GeneratedImage[] } & Pick<React.ComponentProps<"ul">, "aria-label" | "aria-labelledby">) {
  const t = useTranslations("Images");
  const format = useFormatter();

  return (
    <ul {...props} className="gap-4 sm:columns-2 xl:columns-3">
      {images.map((image) => (
        <li
          key={image.id}
          className="relative mb-4 flex break-inside-avoid flex-col overflow-hidden rounded-xl border bg-card has-focus-visible:outline-2 has-focus-visible:outline-ring"
        >
          {image.url ? (
            <ImageViewer image={{ id: image.id, prompt: image.prompt, url: image.url }} className="relative z-10">
              {/* Signed URLs change every hour, so next/image's cache wouldn't help.
                  The ratio holds the space until the image loads, then the
                  image's own takes over: Bailian's sizes are close to, not
                  exactly, the aspect (16:9 is 1696x960). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.prompt}
                loading="lazy"
                className="w-full bg-muted object-contain"
                style={{ aspectRatio: `auto ${image.aspect.replace(":", " / ")}` }}
              />
            </ImageViewer>
          ) : (
            <div
              className="flex w-full items-center justify-center gap-2 bg-muted p-6 text-center text-sm text-muted-foreground"
              style={{ aspectRatio: image.aspect.replace(":", " / ") }}
            >
              <ImageIcon className="size-4 shrink-0" />
              {t(image.status === "failed" ? "failed" : "pending")}
            </div>
          )}
          <div className="flex items-start gap-3 p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={`/images/${image.id}`}
                className="line-clamp-2 text-sm text-pretty outline-none after:absolute after:inset-0"
              >
                {image.prompt}
              </Link>
              <p className="text-xs text-muted-foreground">
                {format.dateTime(image.createdAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            {image.url && (
              // The route answers with a file, so the browser stays on this page.
              <a
                href={`/api/images/${image.id}/download`}
                download
                aria-label={t("download")}
                title={t("download")}
                className="relative flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground"
              >
                <Download className="size-4" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
