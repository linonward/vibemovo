import { useTranslations } from "next-intl";
import { projectConfig } from "project.config";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCS } from "@/lib/content";
import { Brand } from "./brand";
import { ThemeSwitcher } from "./theme-switcher";

const LINK = "text-sm text-muted-foreground [@media(hover:hover)]:hover:text-foreground";

export function Footer() {
  const t = useTranslations("Footer");
  const legal = useTranslations("Legal");
  const pricing = useTranslations("Pricing");
  const blog = useTranslations("Blog");
  const rap = useTranslations("RapLanding");
  const zombie = useTranslations("ZombieLanding");
  const hug = useTranslations("HugLanding");
  const vampire = useTranslations("VampireLanding");
  const raindance = useTranslations("RaindanceLanding");

  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
          <Brand />
          <p className="max-w-xs text-sm text-pretty text-muted-foreground">{t("blurb")}</p>
        </div>
        <nav aria-labelledby="footer-product" className="flex flex-col gap-3">
          <p id="footer-product" className="eyebrow">
            {t("product")}
          </p>
          <ul className="flex flex-col gap-2">
            <li>
              <Link href="/pricing" className={LINK}>
                {pricing("title")}
              </Link>
            </li>
            <li>
              <Link href="/ai-rap-video-generator" className={LINK}>
                {rap("nav")}
              </Link>
            </li>
            <li>
              <Link href="/ai-zombie-couple-video" className={LINK}>
                {zombie("nav")}
              </Link>
            </li>
            <li>
              <Link href="/hug-your-younger-self-ai" className={LINK}>
                {hug("nav")}
              </Link>
            </li>
            <li>
              <Link href="/ai-vampire-transformation-video" className={LINK}>
                {vampire("nav")}
              </Link>
            </li>
            <li>
              <Link href="/raindance-ai-trend" className={LINK}>
                {raindance("nav")}
              </Link>
            </li>
            <li>
              <Link href="/blog" className={LINK}>
                {blog("title")}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-support" className="flex flex-col gap-3">
          <p id="footer-support" className="eyebrow">
            {t("support")}
          </p>
          <a href={`mailto:${projectConfig.supportEmail}`} className={`${LINK} break-all`}>
            {projectConfig.supportEmail}
          </a>
        </nav>
        <nav aria-labelledby="footer-legal" className="flex flex-col gap-3">
          <p id="footer-legal" className="eyebrow">
            {t("legal")}
          </p>
          <ul className="flex flex-col gap-2">
            {LEGAL_DOCS.map((doc) => (
              <li key={doc}>
                <Link href={`/${doc}`} className={LINK}>
                  {legal(doc)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {t("rights", { name: projectConfig.name })}
          </p>
          <ThemeSwitcher />
        </div>
      </div>
    </footer>
  );
}
