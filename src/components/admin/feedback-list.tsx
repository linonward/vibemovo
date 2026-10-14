import { useFormatter, useTranslations } from "next-intl";

export type FeedbackItem = { id: string; message: string; createdAt: Date; name: string; email: string; imageCount: number };

export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  const t = useTranslations("Admin.feedback");
  const format = useFormatter();
  if (!items.length) return <p className="rounded-xl border border-dashed p-8 text-muted-foreground">{t("empty")}</p>;
  return (
    <ul aria-label={t("title")} className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <p className="font-medium">{item.name}</p>
              <p className="text-muted-foreground">{item.email}</p>
            </div>
            <time dateTime={item.createdAt.toISOString()} className="text-muted-foreground">
              {format.dateTime(item.createdAt, { dateStyle: "medium", timeStyle: "short" })}
            </time>
          </div>
          {item.message && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{item.message}</p>}
          {item.imageCount > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: item.imageCount }, (_, index) => {
                const url = `/api/admin/feedback/${item.id}/images/${index}`;
                return (
                  <a key={index} href={url} target="_blank" rel="noopener noreferrer" aria-label={t("openImage", { number: index + 1 })}>
                    {/* Authenticated image routes must use the browser's session cookie. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={t("image", { number: index + 1 })} loading="lazy"
                      className="h-40 w-full rounded-lg border bg-muted object-contain" />
                  </a>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
