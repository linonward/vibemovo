"use client";

import type { UIMessage } from "ai";
import { cn } from "cn";
import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCredits } from "@/components/dashboard/credits";
import { Link, useRouter } from "@/i18n/navigation";
import { Chat } from "./chat";

type ChatSummary = { id: string; title: string };

// Matches the title the server stores: the start of the first message.
const TITLE_CHARS = 60;

export type ChatPanelProps = {
  // The open chat. A new chat gets a fresh ID from the page.
  id: string;
  initialMessages: UIMessage[];
  // Most recent first.
  chats: ChatSummary[];
  enabled: boolean;
  // Credits a reply costs. A failed reply is refunded on the server.
  cost: number;
};

export function ChatPanel({
  id,
  initialMessages,
  chats: initialChats,
  enabled,
  cost,
}: ChatPanelProps) {
  const t = useTranslations("Chat");
  const locale = useLocale();
  const router = useRouter();
  const credits = useCredits();
  const [chats, setChats] = useState(initialChats);
  const [deleting, setDeleting] = useState<ChatSummary | null>(null);
  const [deleteState, setDeleteState] = useState<"idle" | "busy" | "error">("idle");

  // Moves the chat to the top. A new chat also gets its own URL, without a
  // navigation, so the conversation on screen stays as it is.
  function saved(messages: UIMessage[]) {
    setChats((current) => {
      const existing = current.find((c) => c.id === id);
      const rest = current.filter((c) => c.id !== id);
      return [existing ?? { id, title: titleOf(messages) }, ...rest];
    });
    if (!chats.some((c) => c.id === id)) {
      window.history.replaceState(null, "", `/${locale}/chat/${id}`);
    }
    credits?.adjust(-cost);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteState("busy");
    const response = await fetch(`/api/chat/${deleting.id}`, { method: "DELETE" }).catch(() => null);
    // 404: it's already gone.
    if (!response || (!response.ok && response.status !== 404)) {
      setDeleteState("error");
      return;
    }
    setChats((current) => current.filter((c) => c.id !== deleting.id));
    setDeleting(null);
    setDeleteState("idle");
    if (deleting.id === id) router.push("/chat");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
      <nav aria-label={t("list")} className="flex flex-col gap-1 lg:sticky lg:top-6">
        <Link
          href="/chat"
          className="mb-1 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium [@media(hover:hover)]:hover:bg-muted"
        >
          <Plus className="size-4" />
          {t("newChat")}
        </Link>
        {chats.length === 0 && <p className="px-3 text-sm text-muted-foreground">{t("noChats")}</p>}
        <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto lg:max-h-[70vh]">
          {chats.map((chat) => {
            const active = chat.id === id;
            return (
              <li key={chat.id} className="group flex items-center gap-1">
                <Link
                  href={`/chat/${chat.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm [@media(hover:hover)]:hover:bg-muted",
                    active ? "bg-muted font-medium" : "text-muted-foreground",
                  )}
                  title={chat.title}
                >
                  {chat.title}
                </Link>
                <button
                  type="button"
                  aria-label={t("deleteLabel", { title: chat.title })}
                  title={t("deleteLabel", { title: chat.title })}
                  onClick={() => {
                    setDeleting(chat);
                    setDeleteState("idle");
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <Chat id={id} initialMessages={initialMessages} enabled={enabled} onFinish={saved} />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              {t.rich("confirmDescription", {
                title: () => <span className="font-medium text-foreground">{deleting?.title}</span>,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {t("deleteError")}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-white [@media(hover:hover)]:hover:bg-destructive/90"
              disabled={deleteState === "busy"}
              onClick={confirmDelete}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function titleOf(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts.map((part) => (part.type === "text" ? part.text : "")).join("") ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, TITLE_CHARS);
}
