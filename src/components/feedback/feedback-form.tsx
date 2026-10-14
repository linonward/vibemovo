"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ApiBody, ApiErrorCode, FeedbackResponse } from "@/lib/api";

type State = { kind: "idle" | "sending" | "sent" } | { kind: "error"; code?: ApiErrorCode };

export function FeedbackForm({ maxLength, maxImages, maxImageBytes }: {
  maxLength: number; maxImages: number; maxImageBytes: number;
}) {
  const t = useTranslations("Feedback");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const submission = useRef<{ message: string; images: File[]; requestId: string } | null>(null);
  const sending = useRef(false);
  const valid = (message.trim().length > 0 || images.length > 0) && message.trim().length <= maxLength;

  function addImages(files: File[]) {
    if (sending.current) return;
    const next = [...images, ...files];
    if (next.length > maxImages || next.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size)
      || next.reduce((total, file) => total + file.size, 0) > maxImageBytes) {
      setImageError(true);
      return;
    }
    setImages(next);
    setImageError(false);
    setState({ kind: "idle" });
  }

  function chooseImages(event: React.ChangeEvent<HTMLInputElement>) {
    addImages(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function pasteImages(event: React.ClipboardEvent<HTMLFormElement>) {
    if (sending.current) return;
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    // Leave ordinary text paste to the focused input.
    if (!files.length) return;
    event.preventDefault();
    addImages(files);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || sending.current) return;
    sending.current = true;
    setState({ kind: "sending" });
    const text = message.trim();
    if (submission.current?.message !== text || submission.current?.images !== images) {
      submission.current = { message: text, images, requestId: crypto.randomUUID() };
    }
    try {
      const body = new FormData();
      body.set("message", text);
      body.set("requestId", submission.current.requestId);
      images.forEach((file) => body.append("images", file));
      const response = await fetch("/api/feedback", {
        method: "POST",
        body,
      });
      const json: ApiBody<FeedbackResponse> | null = await response.json().catch(() => null);
      if (!response.ok || !json?.feedback?.id) {
        setState({ kind: "error", code: json?.error });
        return;
      }
      setMessage("");
      setImages([]);
      setImageError(false);
      submission.current = null;
      setState({ kind: "sent" });
    } catch {
      setState({ kind: "error" });
    } finally {
      sending.current = false;
    }
  }

  const errorKey = state.kind === "error" && state.code === "RATE_LIMITED" ? "rateLimited"
    : state.kind === "error" && state.code === "UNAUTHORIZED" ? "unauthorized"
    : state.kind === "error" && state.code === "FEEDBACK_STORAGE_DISABLED" ? "storageDisabled" : "error";

  return (
    <form onSubmit={submit} onPaste={pasteImages} className="flex max-w-2xl flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="grid gap-2">
        <Label htmlFor="feedback-message">{t("message")}</Label>
        <textarea
          id="feedback-message"
          required={images.length === 0}
          rows={7}
          maxLength={maxLength}
          value={message}
          disabled={state.kind === "sending"}
          onChange={(event) => { setMessage(event.target.value); setState({ kind: "idle" }); }}
          aria-describedby="feedback-hint"
          className="w-full min-w-0 resize-y rounded-lg border border-input bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <p id="feedback-hint" className="text-sm text-muted-foreground">{t("hint", { max: maxLength })}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="feedback-images">{t("images")}</Label>
        <input id="feedback-images" type="file" accept="image/jpeg,image/png,image/webp" multiple
          disabled={state.kind === "sending"} onChange={chooseImages} aria-describedby="feedback-images-hint"
          className="w-full min-w-0 rounded-lg border border-input px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1" />
        <p id="feedback-images-hint" className="text-sm text-muted-foreground">
          {t("imagesHint", { count: maxImages, mb: maxImageBytes / 1024 / 1024 })}
        </p>
        {imageError && <p role="alert" className="text-sm text-destructive">{t("invalidImages")}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((file, index) => (
            <div key={index} className="flex min-w-0 flex-col gap-2">
              <ImagePreview file={file} />
              <Button type="button" variant="outline" size="sm" disabled={state.kind === "sending"}
                aria-label={t("removeImage", { name: file.name })}
                onClick={() => { setImages(images.filter((_, i) => i !== index)); setImageError(false); setState({ kind: "idle" }); }}>
                {t("remove")}
              </Button>
            </div>
          ))}
        </div>
      </div>
      {state.kind === "sent" && <p role="status" className="text-sm text-primary-text">{t("sent")}</p>}
      {state.kind === "error" && <p role="alert" className="text-sm text-destructive">{t(errorKey)}</p>}
      <Button type="submit" className="self-start" disabled={!valid || state.kind === "sending"}>
        {t(state.kind === "sending" ? "sending" : "submit")}
      </Button>
    </form>
  );
}


function ImagePreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    if (image.current) image.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  // Local object URLs cannot be optimized by next/image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={file.name} className="h-28 w-full rounded-lg border bg-muted object-contain" />;
}
