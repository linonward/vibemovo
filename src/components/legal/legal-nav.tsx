import { FileText, ReceiptText, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { type LegalDoc, LEGAL_DOCS } from "@/lib/content";

const ICONS = {
  privacy: ShieldCheck,
  terms: FileText,
  refund: ReceiptText,
} as const satisfies Record<LegalDoc, unknown>;

// Sidebar on wide screens, a scrollable row of pills on phones.
export function LegalNav({ current }: { current: LegalDoc }) {
  const t = useTranslations("Legal");

  return (
    <nav aria-label={t("nav")} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
        {LEGAL_DOCS.map((doc) => {
          const Icon = ICONS[doc];
          const active = doc === current;
          return (
            <li key={doc} className="shrink-0">
              <Link
                href={`/${doc}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-[background-color,color] duration-150 ${
                  active
                    ? "bg-card font-medium text-foreground shadow-[0_1px_2px_oklch(0.21_0.008_75/0.08)] ring-1 ring-border"
                    : "text-muted-foreground [@media(hover:hover)]:hover:bg-card/60 [@media(hover:hover)]:hover:text-foreground"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-primary-text" : ""}`} />
                {t(doc)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
