import { useTranslations } from "next-intl";
import { SiteAccount } from "@/app/_lib/site-account";
import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <>
      <SiteHeader account={<SiteAccount />} />
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
      >
        <h1 className="display-tight font-display text-3xl font-semibold">{t("title")}</h1>
        <Link href="/" className="font-medium text-primary-text underline underline-offset-4">
          {t("home")}
        </Link>
      </main>
      <Footer />
    </>
  );
}
