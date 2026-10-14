"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { cn } from "cn";
import { SendHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { lazy, memo, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/api";

// react-markdown and remark-gfm are the largest code on this page, and a new
// chat needs them only for its first reply. Loads when the box gets focus.
const loadMarkdown = () => import("./markdown");
const Markdown = lazy(() => loadMarkdown().then((module) => ({ default: module.Markdown })));

// The server keeps the history, so each request sends only the new message.
const transport = new DefaultChatTransport({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ id, messages }) => ({ body: { id, message: messages.at(-1) } }),
});

export type ChatProps = {
  id: string;
  initialMessages?: UIMessage[];
  enabled: boolean;
  // Called after each reply that finished without an error, with the whole
  // conversation. The server has saved it by then.
  onFinish?: (messages: UIMessage[]) => void;
};

export function Chat({ id, initialMessages, enabled, onFinish }: ChatProps) {
  const t = useTranslations("Chat");
  const { messages, sendMessage, status, error } = useChat({
    id,
    messages: initialMessages,
    transport,
    // At most one update per 50 ms while a reply streams.
    throttle: 50,
    onFinish: ({ isError, messages }) => {
      if (!isError) onFinish?.(messages);
    },
  });
  const busy = status === "submitted" || status === "streaming";
  // A reply joins the list as soon as its stream starts, before any text.
  // Show it from its first words; until then, show Thinking.
  const shown = messages.filter((m) => m.role === "user" || hasText(m));
  const thinking = busy && shown.at(-1)?.role !== "assistant";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{enabled ? t("cost") : t("disabled")}</p>

      <div role="log" aria-label={t("log")} className="flex flex-col gap-3">
        {messages.length === 0 && enabled && (
          <p className="rounded-xl border border-dashed px-5 py-8 text-center text-muted-foreground">
            {t("empty")}
          </p>
        )}
        {shown.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {thinking && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("thinking")}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border bg-card px-5 py-4 text-pretty">
          {errorCode(error) === "INSUFFICIENT_CREDITS" ? (
            <>
              {t("noCredits")}{" "}
              <Link href="/billing" className="font-medium underline underline-offset-4">
                {t("buy")}
              </Link>
            </>
          ) : (
            t("failed")
          )}
        </p>
      )}

      <Composer enabled={enabled} busy={busy} onSend={(text) => sendMessage({ text })} />
    </div>
  );
}

// Earlier messages keep their objects while a reply streams, so memo skips
// them and only the streaming reply parses its Markdown again.
const MessageBubble = memo(function MessageBubble({ message }: { message: UIMessage }) {
  return (
    <div
      className={cn(
        "max-w-[85%] min-w-0 rounded-xl px-4 py-3 text-pretty",
        message.role === "user"
          ? "self-end bg-primary whitespace-pre-wrap text-primary-foreground"
          : "border bg-card",
      )}
    >
      {message.role === "user" ? (
        message.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))
      ) : (
        <Suspense fallback={<p className="whitespace-pre-wrap">{text(message)}</p>}>
          <Markdown>{text(message)}</Markdown>
        </Suspense>
      )}
    </div>
  );
});

// The message box keeps its own state, so typing doesn't render the log.
function Composer({ enabled, busy, onSend }: { enabled: boolean; busy: boolean; onSend: (text: string) => void }) {
  const t = useTranslations("Chat");
  const [input, setInput] = useState("");

  function send(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    onSend(text);
    setInput("");
  }

  return (
    <form onSubmit={send} className="flex gap-2">
      <Input
        aria-label={t("label")}
        placeholder={t("placeholder")}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onFocus={() => void loadMarkdown()}
        disabled={!enabled}
        autoComplete="off"
      />
      <Button type="submit" size="lg" disabled={!enabled || busy}>
        <SendHorizontal />
        {t("send")}
      </Button>
    </form>
  );
}

function text(message: UIMessage) {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function hasText(message: UIMessage) {
  return text(message) !== "";
}

// /api/chat answers errors with { error: CODE }; useChat puts the body in message.
function errorCode(error: Error): ApiErrorCode | undefined {
  try {
    return (JSON.parse(error.message) as Partial<ApiErrorBody>).error;
  } catch {
    return undefined;
  }
}
