import { MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Shared by the signed-in layout. Keep it below modal overlays and outside
// the sidebar so it remains available when the mobile menu is closed.
export function FeedbackLink() {
  const t = useTranslations("Dashboard");
  return (
    <Link
      href="/feedback"
      className={buttonVariants({
        variant: "outline",
        className: "fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 h-11 rounded-full shadow-sm",
      })}
    >
      <MessageSquarePlus aria-hidden="true" />
      {t("feedback")}
    </Link>
  );
}
