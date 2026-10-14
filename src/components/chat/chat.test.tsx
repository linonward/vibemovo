import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../messages/en.json";
import { renderWithIntl } from "@/test/intl";
import { Chat } from "./chat";

const sendMessage = vi.fn();
const chat = vi.hoisted(() => ({
  state: {} as { messages?: unknown[]; status?: string; error?: Error },
}));

const ID = "6f1c2c1e-6a43-4f0e-9d5b-7f2a7f1f6a11";
const options = vi.hoisted(() => ({ last: undefined as Record<string, unknown> | undefined }));

vi.mock("@ai-sdk/react", () => ({
  useChat: (init: Record<string, unknown>) => ({
    ...((options.last = init), {}),
    messages: [],
    status: "ready",
    error: undefined,
    sendMessage,
    ...chat.state,
  }),
}));

// Records each Markdown render, so tests can tell which replies re-rendered.
const markdown = vi.hoisted(() => ({ renders: [] as string[] }));
vi.mock("./markdown", () => ({
  Markdown: ({ children }: { children: string }) => {
    markdown.renders.push(children);
    return <div data-markdown>{children}</div>;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: (props: React.ComponentProps<"a">) => <a {...props} />,
}));

afterEach(() => {
  cleanup();
  sendMessage.mockReset();
  chat.state = {};
  markdown.renders = [];
});

test("sends the typed message and clears the box", () => {
  renderWithIntl(<Chat id={ID} enabled />);

  const box = screen.getByRole("textbox", { name: "Message" });
  fireEvent.change(box, { target: { value: "  Hello  " } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(sendMessage).toHaveBeenCalledWith({ text: "Hello" });
  expect((box as HTMLInputElement).value).toBe("");
});

test("doesn't send an empty message", () => {
  renderWithIntl(<Chat id={ID} enabled />);

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(sendMessage).not.toHaveBeenCalled();
});

test("shows the conversation", () => {
  chat.state.messages = [
    { id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] },
    { id: "2", role: "assistant", parts: [{ type: "text", text: "Hello! How can I help?" }] },
  ];
  renderWithIntl(<Chat id={ID} enabled />);

  expect(screen.getByText("Hi")).toBeTruthy();
  expect(screen.getByText("Hello! How can I help?")).toBeTruthy();
});

test("sends users without credits to billing", () => {
  chat.state.status = "error";
  chat.state.error = new Error(JSON.stringify({ error: "INSUFFICIENT_CREDITS" }));
  renderWithIntl(<Chat id={ID} enabled />);

  expect(screen.getByRole("alert").textContent).toContain("You're out of credits.");
  expect(screen.getByRole("link", { name: "Buy credits" }).getAttribute("href")).toBe("/billing");
});

test("explains other failures", () => {
  chat.state.status = "error";
  chat.state.error = new Error("An error occurred.");
  renderWithIntl(<Chat id={ID} enabled />);

  expect(screen.getByRole("alert").textContent).toBe(
    "Something went wrong. Try again.",
  );
});

test("continues the chat it was given", () => {
  const initial = [{ id: "m1", role: "user", parts: [{ type: "text", text: "Earlier" }] }];
  renderWithIntl(<Chat id={ID} initialMessages={initial as never} enabled />);

  expect(options.last).toMatchObject({ id: ID, messages: initial });
});

test("tells the parent when a reply has finished", () => {
  const onFinish = vi.fn();
  renderWithIntl(<Chat id={ID} enabled onFinish={onFinish} />);

  (options.last!.onFinish as (event: object) => void)({ isError: false, messages: [] });
  (options.last!.onFinish as (event: object) => void)({ isError: true, messages: [] });

  expect(onFinish).toHaveBeenCalledTimes(1);
});

test("is read-only when chat is off", () => {
  renderWithIntl(<Chat id={ID} enabled={false} />);

  expect(screen.getByText("Chat is not set up yet.")).toBeTruthy();
  expect((screen.getByRole("textbox", { name: "Message" }) as HTMLInputElement).disabled).toBe(true);
});

test("renders in Chinese", () => {
  renderWithIntl(<Chat id={ID} enabled />, "zh");

  expect(screen.getByRole("button", { name: "发送" })).toBeTruthy();
});

test("shows Thinking instead of an empty reply before the first words arrive", () => {
  chat.state.status = "streaming";
  chat.state.messages = [
    { id: "1", role: "user", parts: [{ type: "text", text: "Who are you" }] },
    { id: "2", role: "assistant", parts: [{ type: "step-start" }] },
  ];
  renderWithIntl(<Chat id={ID} enabled />);

  const log = screen.getByRole("log");
  expect(log.children).toHaveLength(2);
  expect(log.children[0].textContent).toBe("Who are you");
  expect(screen.getByRole("status").textContent).toBe("Thinking…");
});

test("hides Thinking once the reply has words", () => {
  chat.state.status = "streaming";
  chat.state.messages = [
    { id: "1", role: "user", parts: [{ type: "text", text: "Who are you" }] },
    { id: "2", role: "assistant", parts: [{ type: "step-start" }, { type: "text", text: "I'm" }] },
  ];
  renderWithIntl(<Chat id={ID} enabled />);

  expect(screen.getByText("I'm")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});

test("keeps the user's text as typed and renders replies as Markdown", async () => {
  chat.state.messages = [
    { id: "1", role: "user", parts: [{ type: "text", text: "**not bold**" }] },
    { id: "2", role: "assistant", parts: [{ type: "text", text: "**bold**" }] },
  ];
  renderWithIntl(<Chat id={ID} enabled />);

  const [user, reply] = screen.getByRole("log").children;
  expect(user.textContent).toBe("**not bold**");
  await waitFor(() => expect(reply.querySelector("[data-markdown]")?.textContent).toBe("**bold**"));
});

// Typing and each streamed chunk re-render the chat. Earlier replies keep
// their message objects, so they skip the Markdown parse.
test("typing doesn't render the replies again", async () => {
  chat.state.messages = [
    { id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] },
    { id: "2", role: "assistant", parts: [{ type: "text", text: "Hello" }] },
  ];
  renderWithIntl(<Chat id={ID} enabled />);
  await waitFor(() => expect(markdown.renders).toEqual(["Hello"]));

  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Tell me more" } });

  expect(markdown.renders).toEqual(["Hello"]);
});

test("a streamed chunk renders only the reply it changes", async () => {
  const earlier = { id: "2", role: "assistant", parts: [{ type: "text", text: "Hello" }] };
  const question = { id: "3", role: "user", parts: [{ type: "text", text: "More?" }] };
  chat.state.status = "streaming";
  chat.state.messages = [earlier, question, { id: "4", role: "assistant", parts: [{ type: "text", text: "Sure" }] }];
  const { rerender } = renderWithIntl(<Chat id={ID} enabled />);
  await waitFor(() => expect(markdown.renders).toEqual(["Hello", "Sure"]));

  chat.state.messages = [earlier, question, { id: "4", role: "assistant", parts: [{ type: "text", text: "Sure, here" }] }];
  rerender(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <Chat id={ID} enabled />
    </NextIntlClientProvider>,
  );

  expect(markdown.renders).toEqual(["Hello", "Sure", "Sure, here"]);
});

test("batches streamed chunks into at most one update per 50 ms", () => {
  renderWithIntl(<Chat id={ID} enabled />);

  expect(options.last?.throttle).toBe(50);
});
