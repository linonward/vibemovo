import { ArrowRight, LayoutDashboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Empty state for the main view. Replace with your product.
export function DashboardHome() {
  const t = useTranslations("Dashboard");

  return (
    <section className="flex flex-col items-start gap-4 rounded-xl border border-dashed p-8">
      <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <LayoutDashboard className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold">{t("emptyTitle")}</h2>
        <p className="max-w-[56ch] text-pretty text-muted-foreground">{t("emptyBody")}</p>
      </div>
      <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
        {t("emptyAction")}
        <ArrowRight className="icon-nudge" />
      </Link>
    </section>
  );
}
