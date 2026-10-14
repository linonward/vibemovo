"use client";

import {
  Clapperboard,
  CreditCard,
  KeyRound,
  ImageIcon,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";
import { Brand } from "@/components/layout/brand";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import { markSidebarCollapsed } from "./sidebar-state";
import { UserMenu } from "./user-menu";

// The dashboard home sits on top. The rest is grouped by what the user
// came to do, each group under a label (hidden in the collapsed sidebar).
const HOME = [{ href: "/dashboard", key: "title", icon: LayoutDashboard }] as const;

const CREATE = [
  { href: "/chat", key: "chat", icon: MessageSquare },
  {
    href: "/images",
    key: "images",
    icon: ImageIcon,
    children: [{ href: "/images/library", key: "imageLibrary" }],
  },
  {
    href: "/videos",
    key: "videos",
    icon: Clapperboard,
    children: [
      { href: "/videos/rap", key: "videoRap" },
      { href: "/videos/library", key: "videoLibrary" },
    ],
  },
] as const;

const ACCOUNT = [
  { href: "/billing", key: "billing", icon: CreditCard },
  { href: "/api-keys", key: "apiKeys", icon: KeyRound },
] as const;

// Shown only to admins. The admin pages check access themselves. /admin
// opens the first sub page, so Admin still works in the collapsed sidebar.
const ADMIN_ITEMS = [
  {
    href: "/admin",
    key: "admin",
    icon: ShieldCheck,
    children: [
      { href: "/admin/users", key: "adminUsers" },
      { href: "/admin/orders", key: "adminOrders" },
      { href: "/admin/notifications", key: "adminBroadcasts" },
      { href: "/admin/metrics", key: "adminMetrics" },
      { href: "/admin/feedback", key: "adminFeedback" },
    ],
  },
] as const;

type Item = {
  href: string;
  key: Parameters<ReturnType<typeof useTranslations<"Dashboard">>>[0];
  icon: React.ComponentType;
  children?: readonly { href: string; key: Item["key"] }[];
};

type User = { name: string; email: string; plan: string | null };

export function AppSidebar({ user, isAdmin }: { user: User; isAdmin: boolean }) {
  const t = useTranslations("Dashboard");
  const { isMobile } = useSidebar();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="flex-row items-center justify-between py-3 pr-2 pl-4 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-2">
        <Brand href="/dashboard" className="group-data-[collapsible=icon]:hidden" />
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
          <NotificationBell side={isMobile ? "bottom" : "right"} />
          <CollapseButton />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t("nav")}>
          <NavGroup items={HOME} />
          <NavGroup label={t("groups.create")} items={CREATE} />
          <NavGroup label={t("groups.account")} items={ACCOUNT} />
          {isAdmin && <NavGroup items={ADMIN_ITEMS} />}
        </nav>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <UserMenu {...user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

// One group of links. With a label, the list is named by it.
function NavGroup({ label, items }: { label?: string; items: readonly Item[] }) {
  const t = useTranslations("Dashboard");
  const pathname = usePathname();
  const labelId = useId();

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel id={labelId}>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1" aria-labelledby={label ? labelId : undefined}>
          {items.map(({ href, key, icon: Icon, children }) => {
            const within = pathname === href || pathname.startsWith(`${href}/`);
            // A parent with sub pages is highlighted, but the sub item is the page.
            const current = within && !children?.some((c) => pathname === c.href);
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  isActive={within}
                  tooltip={t(key)}
                  className="h-10 rounded-xl px-3 data-active:bg-primary-text/10 data-active:text-primary-text [&_svg]:size-[18px]"
                  render={<Link href={href} aria-current={current ? "page" : undefined} />}
                >
                  <Icon />
                  <span>{t(key)}</span>
                </SidebarMenuButton>
                {children && (
                  <SidebarMenuSub className="mt-1">
                    {children.map((child) => {
                      const active =
                        pathname === child.href || pathname.startsWith(`${child.href}/`);
                      return (
                        <SidebarMenuSubItem key={child.href}>
                          <SidebarMenuSubButton
                            isActive={active}
                            className="h-8 rounded-lg data-active:bg-transparent data-active:font-semibold data-active:text-primary-text"
                            render={
                              <Link
                                href={child.href}
                                aria-current={pathname === child.href ? "page" : undefined}
                              />
                            }
                          >
                            <span>{t(child.key)}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// Desktop only: phones open the sidebar as a sheet from MobileBar.
function CollapseButton() {
  const t = useTranslations("Dashboard");
  const { state, toggleSidebar } = useSidebar();
  useEffect(() => markSidebarCollapsed(state === "collapsed"), [state]);
  const label = state === "expanded" ? t("collapse") : t("expand");
  const Icon = state === "expanded" ? PanelLeftClose : PanelLeftOpen;

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={label}
      title={label}
      className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-ring md:flex [@media(hover:hover)]:hover:bg-sidebar-accent [@media(hover:hover)]:hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  );
}
