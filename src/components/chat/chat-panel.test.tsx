import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { CreditsProvider, useCredits } from "@/components/dashboard/credits";
import { renderWithIntl } from "@/test/intl";
import { ChatPanel } from "./chat-panel";

const NEW_ID = "6f1c2c1e-6a43-4f0e-9d5b-7f2a7f1f6a11";
const chats = [
  { id: "a0000000-0000-4000-8000-000000000001", title: "Trip to Kyoto" },
  { id: "a0000000-0000-4000-8000-000000000002", title: "Tax questions" },
];

const push = vi.fn();
const fetchMock = vi.fn();
const replaceState = vi.fn();
const finish = vi.hoisted(() => ({ fire: undefined as undefined | ((event: object) => void) }));

vi.mock("@ai-sdk/react", () => ({
  useChat: (init: { onFinish: (event: object) => void }) => {
    finish.fire = init.onFinish;
    return { messages: [], status: "ready", error: undefined, sendMessage: vi.fn() };
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: (props: React.ComponentProps<"a">) => <a {...props} />,
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window.history, "replaceState").mockImplementation(replaceState);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  push.mockReset();
  fetchMock.mockReset();
  replaceState.mockReset();
});

const list = () => screen.getByRole("navigation", { name: "Conversations" });

test("lists past chats and marks the open one", () => {
  renderWithIntl(<ChatPanel id={chats[1].id} chats={chats} initialMessages={[]} enabled cost={1} />);

  const links = within(list()).getAllByRole("link");
  expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["New chat", "/chat"],
    ["Trip to Kyoto", `/chat/${chats[0].id}`],
    ["Tax questions", `/chat/${chats[1].id}`],
  ]);
  expect(within(list()).getByRole("link", { name: "Tax questions" }).getAttribute("aria-current")).toBe(
    "page",
  );
});

test("a new chat joins the top of the list and gets its own URL after the first reply", () => {
  renderWithIntl(<ChatPanel id={NEW_ID} chats={chats} initialMessages={[]} enabled cost={1} />);

  finish.fire!({
    isError: false,
    messages: [
      { id: "m1", role: "user", parts: [{ type: "text", text: "  What is   a closure?  " }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "A function that…" }] },
    ],
  });

  expect(replaceState).toHaveBeenCalledWith(null, "", `/en/chat/${NEW_ID}`);
  return waitFor(() =>
    expect(within(list()).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "New chat",
      "What is a closure?",
      "Trip to Kyoto",
      "Tax questions",
    ]),
  );
});

test("a reply takes its cost off the sidebar balance", async () => {
  renderWithIntl(
    <CreditsProvider balance={10}>
      <ChatPanel id={NEW_ID} chats={chats} initialMessages={[]} enabled cost={1} />
      <SidebarBalance />
    </CreditsProvider>,
  );

  act(() =>
    finish.fire!({
      isError: false,
      messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }],
    }),
  );

  await waitFor(() => expect(screen.getByLabelText("Sidebar balance").textContent).toBe("9"));
});

// Stands in for the sidebar's account menu.
function SidebarBalance() {
  return <output aria-label="Sidebar balance">{useCredits()?.balance}</output>;
}

test("a continued chat moves to the top without changing the URL", async () => {
  renderWithIntl(<ChatPanel id={chats[1].id} chats={chats} initialMessages={[]} enabled cost={1} />);

  finish.fire!({ isError: false, messages: [] });

  expect(replaceState).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(within(list()).getAllByRole("link")[1].textContent).toBe("Tax questions"),
  );
});

test("deletes a chat after confirming", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  renderWithIntl(<ChatPanel id={chats[1].id} chats={chats} initialMessages={[]} enabled cost={1} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete “Trip to Kyoto”" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

  await waitFor(() => expect(within(list()).queryByText("Trip to Kyoto")).toBeNull());
  expect(fetchMock).toHaveBeenCalledWith(`/api/chat/${chats[0].id}`, { method: "DELETE" });
  expect(push).not.toHaveBeenCalled();
});

test("deleting the open chat starts a new one", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  renderWithIntl(<ChatPanel id={chats[0].id} chats={chats} initialMessages={[]} enabled cost={1} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete “Trip to Kyoto”" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/chat"));
});

test("keeps the chat and says so when deleting fails", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
  renderWithIntl(<ChatPanel id={chats[1].id} chats={chats} initialMessages={[]} enabled cost={1} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete “Trip to Kyoto”" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

  expect(await screen.findByText("Couldn't delete the chat. Try again.")).toBeTruthy();
  // The open dialog hides the page behind it.
  const behind = screen.getByRole("navigation", { name: "Conversations", hidden: true });
  expect(within(behind).getByText("Trip to Kyoto")).toBeTruthy();
});
