import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { ChatPanel } from "@/components/chat/chat-panel";
import { redirect } from "@/i18n/navigation";
import { chatEnabled } from "@/server/ai/chat";
import { CHAT_CREDIT_COST } from "@/server/ai/config";
import { listChats, loadChat } from "@/server/ai/chats";

type Params = PageProps<"/[locale]/chat/[[...id]]">["params"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Chat");
  return { title: t("title") };
}

// /chat starts a new chat; /chat/<id> opens a saved one. The title is
// static. The rest reads the request, behind this page's own Suspense.
export default async function ChatPage({ params }: PageProps<"/[locale]/chat/[[...id]]">) {
  const t = await getTranslations("Chat");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton />}>
        <ChatContent params={params} />
      </Suspense>
    </>
  );
}

async function ChatContent({ params }: { params: Params }) {
  const session = await currentSession();
  if (!session) return redirect({ href: "/sign-in", locale: await getLocale() });

  const { id: segments } = await params;
  if (segments && segments.length !== 1) notFound();
  const [chats, saved] = await Promise.all([
    listChats(session.user.id),
    segments ? loadChat(session.user.id, segments[0]) : null,
  ]);
  // Also hides chats that belong to someone else.
  if (segments && !saved) notFound();
  const id = saved?.id ?? randomUUID();

  return (
    <ChatPanel
      // A different chat starts from a clean slate.
      key={id}
      id={id}
      initialMessages={saved?.messages ?? []}
      chats={chats.map(({ id, title }) => ({ id, title }))}
      enabled={chatEnabled()}
      cost={CHAT_CREDIT_COST}
    />
  );
}
