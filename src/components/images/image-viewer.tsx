"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const toolClass =
  "flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color] duration-150 focus-visible:outline-2 focus-visible:outline-white [@media(hover:hover)]:hover:bg-white/20";

// Wraps a stored image's thumbnail in a button that shows the image full
// screen. Esc, the close button or a click beside the image closes it.
export function ImageViewer({
  image,
  className,
  children,
}: {
  image: { id: string; prompt: string; url: string };
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Images");
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={t("viewFullScreen")}
        className={`block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${className ?? ""}`}
      >
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/90 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
          <Dialog.Title className="sr-only">{image.prompt}</Dialog.Title>
          <div className="flex justify-end gap-2 p-3">
            {/* The route answers with a file, so the browser stays on this page. */}
            <a
              href={`/api/images/${image.id}/download`}
              download
              aria-label={t("download")}
              title={t("download")}
              className={toolClass}
            >
              <Download className="size-5" />
            </a>
            <Dialog.Close aria-label={t("close")} title={t("close")} className={toolClass}>
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div
            data-testid="image-viewer-stage"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
            className="flex min-h-0 flex-1 items-center justify-center px-3 pb-3 sm:px-6 sm:pb-6"
          >
            {/* Signed URLs change every hour, so next/image's cache wouldn't help. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.prompt} className="max-h-full max-w-full object-contain" />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
