"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import {
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  Gem,
  Languages,
  LogOut,
  Palette,
  UserRound,
  Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { projectConfig } from "project.config";
import { LocaleItems } from "@/components/layout/locale-switcher";
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from "@/components/layout/theme";
import { THEME_OPTIONS } from "@/components/layout/theme-switcher";
import { useCredits } from "./credits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link, useRouter } from "@/i18n/navigation";
import { LOCALE_NAMES, type Locale } from "@/i18n/routing";

const ROW =
  "h-10 gap-3 rounded-xl px-3 text-sm font-medium [&_svg:not([class*='size-'])]:size-[18px]";

// Account menu at the bottom of the sidebar (docs/DESIGN.md, User menu).
export function UserMenu({
  name,
  email,
  plan,
}: {
  name: string;
  email: string;
  plan: string | null;
}) {
  const t = useTranslations("Dashboard");
  const tLocale = useTranslations("LocaleSwitcher");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const tTheme = useTranslations("Theme");
  const theme = useThemePreference();
  // Beside the sidebar on desktop; above the trigger in the phone sheet,
  // where there is no room to the right.
  const isMobile = useIsMobile();
  const balance = useCredits()?.balance ?? 0;
  const initial = (name || email).trim().charAt(0).toUpperCase();
  // Known plans are translated; anything else shows as stored.
  const planKey = `plans.${plan}` as Parameters<typeof t>[0];
  const planName = !plan ? t("planFree") : t.has(planKey) ? t(planKey) : plan;

  async function signOut() {
    // Loaded here: every dashboard page shows this menu, and only signing
    // out needs Better Auth's client.
    const { authClient } = await import("@/lib/auth-client");
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("account")}
        className="flex w-full items-center gap-2 overflow-hidden rounded-xl p-1.5 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring data-popup-open:bg-sidebar-accent group-data-[collapsible=icon]:p-0 [@media(hover:hover)]:hover:bg-sidebar-accent"
      >
        <Avatar initial={initial} className="size-8 text-sm" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground group-data-[collapsible=icon]:hidden">
          {email}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? "top" : "right"}
        align={isMobile ? "start" : "end"}
        sideOffset={isMobile ? 8 : 20}
        className="flex w-80 max-w-[calc(100vw-1rem)] flex-col gap-2 rounded-2xl p-3"
      >
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <Avatar initial={initial} className="size-11 text-base" />
          <div className="min-w-0">
            {name && <p className="truncate font-semibold">{name}</p>}
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-primary-text/40 bg-primary-text/5 p-4">
          <p className="font-display text-[11px] font-bold tracking-[0.17em] text-primary-text uppercase">
            {t("plan", { name: projectConfig.name })}
          </p>
          <p className="mt-1 text-[22px] leading-tight font-black">{planName}</p>
          <Gem
            aria-hidden
            className="absolute top-1/2 right-4 size-14 -translate-y-1/2 text-foreground/10"
          />
        </div>

        <DropdownMenuItem
          render={<Link href="/billing" />}
          className="h-12 gap-3 rounded-xl border bg-card px-3"
        >
          <Gem className="size-[18px] text-primary-text" />
          <span className="font-display text-lg font-bold tabular-nums">{balance}</span>{" "}
          <span className="text-muted-foreground">{t("creditsLeft", { count: balance })}</span>
          <ChevronRight className="ml-auto text-muted-foreground" />
        </DropdownMenuItem>

        <DropdownMenuSeparator className="mx-0" />

        {/* Subscribers have no higher plan to upgrade to. */}
        <DropdownMenuItem render={<Link href="/billing" />} className={ROW}>
          {plan ? <CreditCard /> : <Zap />}
          {plan ? t("manageSubscription") : t("upgrade")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/profile" />} className={ROW}>
          <UserRound />
          {t("profile")}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            aria-label={tLocale("current", { name: LOCALE_NAMES[locale] })}
            className={ROW}
          >
            <Languages />
            {t("language")}
            <span className="ml-auto rounded-full border px-3 py-0.5 text-xs font-semibold">
              {LOCALE_NAMES[locale]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <LocaleItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <div className={`flex items-center ${ROW}`}>
          <Palette className="size-[18px] text-muted-foreground" />
          {tTheme("label")}
          <MenuPrimitive.RadioGroup
            value={theme}
            onValueChange={(value: ThemePreference) => setThemePreference(value)}
            aria-label={tTheme("label")}
            className="ml-auto flex rounded-full bg-muted p-1"
          >
            {THEME_OPTIONS.map(({ value, icon: Icon }) => (
              <MenuPrimitive.RadioItem
                key={value}
                value={value}
                closeOnClick={false}
                aria-label={tTheme(value)}
                title={tTheme(value)}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground outline-hidden select-none focus-visible:ring-2 focus-visible:ring-ring data-checked:bg-accent data-checked:text-foreground"
              >
                <Icon className="size-4" />
              </MenuPrimitive.RadioItem>
            ))}
          </MenuPrimitive.RadioGroup>
        </div>

        <DropdownMenuSeparator className="mx-0" />

        <DropdownMenuItem onClick={signOut} className={ROW}>
          <LogOut />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({ initial, className }: { initial: string; className: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground ${className}`}
    >
      {initial}
    </span>
  );
}
