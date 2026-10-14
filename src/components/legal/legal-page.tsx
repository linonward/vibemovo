import { getLocale, getTranslations } from "next-intl/server";
import { type LegalDoc, loadLegalDoc } from "@/lib/content";
import { LegalNav } from "./legal-nav";

export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const locale = await getLocale();
  const t = await getTranslations("Legal");
  const Content = await loadLegalDoc(locale, doc);

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12"
    >
      <LegalNav current={doc} />
      <article className="flex w-full max-w-[44rem] min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary-text">{t("eyebrow")}</p>
          <h1 className="display-tight font-display text-3xl font-semibold sm:text-4xl">
            {t(doc)}
          </h1>
        </header>
        <div className="legal-prose rounded-xl border bg-card p-6 sm:p-10">
          <Content />
        </div>
      </article>
    </main>
  );
}
