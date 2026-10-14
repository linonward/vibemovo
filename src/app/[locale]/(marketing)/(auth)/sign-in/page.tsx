import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SignIn");
  // A sign-in form answers no search, and ?next= makes a URL per page.
  return { title: t("title"), description: t("subtitle"), robots: { index: false } };
}

export default function SignInPage() {
  const t = useTranslations("SignIn");

  return (
    <main id="main-content" className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
      <div className="flex w-full max-w-md flex-col gap-8 rounded-2xl border bg-card p-6 shadow-[0_24px_48px_-24px_oklch(0.21_0.008_75/0.25)] sm:p-10">
        <div className="flex flex-col gap-2">
          <h1 className="display-tight font-display text-3xl font-semibold">{t("title")}</h1>
          <p className="text-pretty text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      </div>
    </main>
  );
}
