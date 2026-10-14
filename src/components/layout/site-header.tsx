import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Brand } from "./brand";
import { LocaleSwitcher } from "./locale-switcher";

// Sticky glass bar (docs/DESIGN.md, Effects). `account` is the button on the
// right: the marketing layout passes <AccountLink /> for the visitor.
export function SiteHeader({ account }: { account: React.ReactNode }) {
  const tBlog = useTranslations("Blog");
  const tPricing = useTranslations("Pricing");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/65 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <Brand />
        <div className="flex items-center gap-2 sm:gap-6">
          <Link
            href="/pricing"
            className="text-sm font-semibold underline-offset-4 [@media(hover:hover)]:hover:underline"
          >
            {tPricing("title")}
          </Link>
          {/* Phones reach the blog from the footer, so the header fits 320px. */}
          <Link
            href="/blog"
            className="hidden text-sm font-semibold underline-offset-4 sm:inline [@media(hover:hover)]:hover:underline"
          >
            {tBlog("title")}
          </Link>
          <LocaleSwitcher />
          {account}
        </div>
      </div>
    </header>
  );
}

// Sign in for visitors, the dashboard for signed-in users. Smaller on
// phones, so the header fits 320px.
export function AccountLink({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations(signedIn ? "Dashboard" : "SignIn");

  return (
    <Link href={signedIn ? "/dashboard" : "/sign-in"} className={cn(buttonVariants(), "h-9 px-2.5 sm:h-10 sm:px-4")}>
      {t("title")}
    </Link>
  );
}
