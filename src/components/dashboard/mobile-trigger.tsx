"use client";

import { PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Brand } from "@/components/layout/brand";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useSidebar } from "@/components/ui/sidebar";

// Phones only: the sidebar lives in a sheet, opened from this bar.
export function MobileBar() {
  const t = useTranslations("Dashboard");
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 md:hidden">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={t("openMenu")}
        className="flex size-9 items-center justify-center rounded-lg border bg-card focus-visible:outline-2 focus-visible:outline-ring"
      >
        <PanelLeft className="size-4" />
      </button>
      <Brand href="/dashboard" />
      <div className="ml-auto">
        <NotificationBell />
      </div>
    </div>
  );
}
