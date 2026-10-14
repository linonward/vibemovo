import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { AppNotification } from "@/lib/api";
import { renderWithIntl } from "@/test/intl";
import { NotificationList } from "./notification-list";
import { NotificationsProvider } from "./notifications";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    ...props
  }: Omit<React.ComponentProps<"a">, "href"> & { href: string | { pathname: string; query: Record<string, string> } }) => (
    <a
      href={typeof href === "string" ? `/en${href}` : `/en${href.pathname}?${new URLSearchParams(href.query)}`}
      {...props}
    />
  ),
}));

const notifications: AppNotification[] = [
  {
    id: "n1",
    type: "image_failed",
    data: { imageId: "i1", prompt: "A flower shop", credits: 2 },
    readAt: null,
    createdAt: new Date(),
  },
  {
    id: "n2",
    type: "video_succeeded",
    data: { videoId: "v1", prompt: "The fox runs" },
    readAt: null,
    createdAt: new Date(),
  },
];

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
  Response.json({ unread: 0 }),
);

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const renderList = (list = notifications, page = 1, pageCount = 1) =>
  renderWithIntl(
    <NotificationsProvider unread={list.filter((n) => !n.readAt).length}>
      <NotificationList notifications={list} page={page} pageCount={pageCount} />
    </NotificationsProvider>,
  );

test("lists the page's notifications and links to the pages around it", () => {
  renderList(notifications, 2, 3);

  const items = within(screen.getByRole("list", { name: "Notifications" })).getAllByRole("link");
  expect(items.map((a) => a.getAttribute("href"))).toEqual(["/en/images/i1", "/en/videos/v1"]);
  expect(items[0].textContent).toContain("Your image failed");
  expect(items[0].textContent).toContain("2 credits were refunded.");
  expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href")).toBe("/en/notifications?page=1");
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/en/notifications?page=3");
});

test("opening a notification marks it read", async () => {
  renderList();

  fireEvent.click(screen.getByRole("link", { name: /Your image failed/ }));

  expect(screen.getByRole("link", { name: /Your image failed/ }).textContent).not.toContain("Unread");
  expect(screen.getByRole("link", { name: /Your video is ready/ }).textContent).toContain("Unread");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/notifications/read",
    expect.objectContaining({ body: JSON.stringify({ id: "n1" }) }),
  );
});

test("marks all read, then hides the button", async () => {
  renderList();

  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

  expect(screen.queryByText("Unread")).toBeNull();
  await waitFor(() => expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull());
});

test("writes payment and credit notifications and links them to billing", () => {
  const at = { readAt: new Date(), createdAt: new Date() };
  renderList([
    { id: "a", type: "order_paid", data: { orderId: "o1", credits: 100 }, ...at },
    { id: "b", type: "subscription_paid", data: { planId: "pro", credits: 1000 }, ...at },
    { id: "c", type: "subscription_past_due", data: { planId: "pro" }, ...at },
    { id: "d", type: "subscription_ended", data: { planId: "legacy" }, ...at },
    { id: "e", type: "credits_added", data: { credits: 1 }, ...at },
  ]);

  const items = within(screen.getByRole("list", { name: "Notifications" })).getAllByRole("link");
  expect(items.map((a) => [a.getAttribute("href"), a.textContent])).toEqual([
    ["/en/billing", expect.stringContaining("Payment received100 credits were added.")],
    ["/en/billing", expect.stringContaining("Subscription payment receivedPro plan: 1,000 credits were added.")],
    ["/en/billing", expect.stringContaining("Subscription payment failedUpdate your payment method to keep the Pro plan.")],
    // An unknown plan shows as stored.
    ["/en/billing", expect.stringContaining("Your subscription endedThe legacy plan has ended.")],
    ["/en/billing", expect.stringContaining("Credits added1 credit was added.")],
  ]);
});

test("shows a broadcast's own title and whole message, linked to this page", () => {
  renderList([
    {
      id: "a",
      type: "broadcast",
      data: { broadcastId: "b1", title: "Maintenance", body: "Line one\nLine two" },
      readAt: null,
      createdAt: new Date(),
    },
  ]);

  const [item] = within(screen.getByRole("list", { name: "Notifications" })).getAllByRole("link");
  expect(item.getAttribute("href")).toBe("/en/notifications");
  expect(item.textContent).toContain("MaintenanceLine one\nLine two");
});

test("says so when there are no notifications", () => {
  renderList([]);

  expect(screen.getByText("No notifications yet.")).toBeTruthy();
});
