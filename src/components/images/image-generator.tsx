"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCreditBalance } from "@/components/dashboard/credits";
import { PromptExamples } from "@/components/dashboard/prompt-examples";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePendingPoll } from "@/hooks/use-pending-poll";
import { Link } from "@/i18n/navigation";
import type { ApiBody, ApiErrorCode, GeneratedImage, ImageResponse, Serialized } from "@/lib/api";
import { ImageList } from "./image-list";

type Image = GeneratedImage;

export type ImageGeneratorProps = {
  balance: number;
  // Credits per image.
  cost: number;
  aspects: readonly string[];
  maxPromptLength: number;
  // False when Bailian or storage isn't configured.
  enabled: boolean;
  images: Image[];
};

const POLL_MS = 3000;

const EXAMPLES = ["flowerShop", "product", "portrait", "cityNight", "poster"] as const;

const ERRORS = {
  INSUFFICIENT_CREDITS: "errors.credits",
  CONTENT_BLOCKED: "errors.blocked",
  IMAGES_DISABLED: "disabled",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

const parse = (image: Serialized<Image>): Image => ({ ...image, createdAt: new Date(image.createdAt) });

export function ImageGenerator(props: ImageGeneratorProps) {
  const t = useTranslations("Images");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState(props.aspects[0]);
  const { balance, adjust: adjustCredits } = useCreditBalance(props.balance);
  const [images, setImages] = useState(props.images);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAfford = balance >= props.cost;
  const examples = EXAMPLES.map((key) => ({
    label: t(`examples.${key}.label`),
    prompt: t(`examples.${key}.prompt`),
  }));
  const generate = t("generate", { count: props.cost });
  const pendingIds = images.filter((image) => image.status === "pending").map((image) => image.id);
  const { cost } = props;

  // A failure was refunded on the server, so the balance gets the credit back.
  usePendingPoll({
    ids: pendingIds,
    intervalMs: POLL_MS,
    url: (id) => `/api/images/${id}`,
    onBody: (id, body) => {
      const { image } = body as ApiBody<ImageResponse>;
      if (!image || image.status === "pending") return;
      const updated = parse(image);
      setImages((current) => current.map((item) => (item.id === id ? updated : item)));
      if (updated.status === "failed") {
        adjustCredits(cost, `image-refund:${id}`);
      }
    },
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, aspect }),
    }).catch(() => null);
    const body: ApiBody<ImageResponse> = response ? await response.json().catch(() => ({})) : {};
    setSubmitting(false);

    const { image } = body;
    if (response?.ok && image) {
      setImages((current) => [parse(image), ...current]);
      adjustCredits(-cost, `image:${image.id}`);
      return;
    }
    setError(t(ERRORS[body.error as keyof typeof ERRORS] ?? "errors.failed"));
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl border bg-card p-5">
        {!props.enabled && <p className="text-muted-foreground">{t("disabled")}</p>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="image-prompt">{t("prompt")}</Label>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={props.maxPromptLength}
            rows={4}
            placeholder={t("placeholder")}
            className="w-full min-w-0 resize-y rounded-lg border border-input bg-card px-3 py-2 text-base transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
          <PromptExamples examples={examples} onPick={setPrompt} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("aspect")}</legend>
          <div className="flex flex-wrap gap-2">
            {props.aspects.map((value) => (
              <label
                key={value}
                className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-[background-color,border-color] duration-150 has-checked:border-foreground has-checked:bg-muted has-focus-visible:outline-2 has-focus-visible:outline-ring"
              >
                <input
                  type="radio"
                  name="aspect"
                  value={value}
                  checked={aspect === value}
                  onChange={() => setAspect(value)}
                  className="sr-only"
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            type="submit"
            disabled={!props.enabled || !canAfford || submitting || prompt.trim() === ""}
          >
            <Sparkles />
            {submitting ? t("generating") : generate}
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
          <h2 id="images-title" className="font-display text-lg font-semibold">
            {t("historyTitle")}
          </h2>
          {images.length > 0 && (
            <Link href="/images/library" className="text-sm underline underline-offset-4">
              {t("viewAll")}
            </Link>
          )}
        </div>
        {images.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <ImageList images={images} aria-labelledby="images-title" />
        )}
      </section>
    </div>
  );
}
