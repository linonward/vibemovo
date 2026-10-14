import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { AppNotification } from "@/lib/api";
import { renderWithIntl } from "@/test/intl";
import { NotificationBell } from "./notification-bell";
import { NotificationsProvider, POLL_MS } from "./notifications";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: Omit<React.ComponentProps<"a">, "href"> & { href: string }) => (
    <a href={`/en${href}`} {...props} />
  ),
}));

const notifications: AppNotification[] = [
  {
    id: "n1",
    type: "video_failed",
    data: { videoId: "v1", prompt: "The fox runs", credits: 40 },
    readAt: null,
    createdAt: new Date(),
  },
  {
    id: "n2",
    type: "image_succeeded",
    data: { imageId: "i1", prompt: "A flower shop" },
    readAt: new Date(),
    createdAt: new Date(),
  },
];

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
  Response.json(url === "/api/notifications" ? { notifications, unread: 1 } : { unread: 0 }),
);

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
  setVisibility("visible");
});

const renderBell = (unread: number) =>
  renderWithIntl(
    <NotificationsProvider unread={unread}>
      <NotificationBell />
    </NotificationsProvider>,
  );

test("shows the unread count from the server, and no count without unread", () => {
  renderBell(3);
  expect(screen.getByRole("button", { name: "Notifications, 3 unread" }).textContent).toBe("3");
  cleanup();

  renderBell(0);
  expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");
});

test("opening fetches the newest notifications and links each to its page", async () => {
  renderBell(1);

  fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

  const failed = await screen.findByRole("menuitem", { name: /Your video failed/ });
  expect(failed.getAttribute("href")).toBe("/en/videos/v1");
  expect(failed.textContent).toContain("40 credits were refunded.");
  expect(failed.textContent).toContain("Unread");
  const ready = screen.getByRole("menuitem", { name: /Your image is ready/ });
  expect(ready.getAttribute("href")).toBe("/en/images/i1");
  expect(ready.textContent).not.toContain("Unread");
  expect(screen.getByRole("menuitem", { name: "View all" }).getAttribute("href")).toBe("/en/notifications");
});

test("choosing an unread notification marks it read", async () => {
  renderBell(1);
  fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

  fireEvent.click(await screen.findByRole("menuitem", { name: /Your video failed/ }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/notifications/read",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ id: "n1" }) }),
  );
});

test("marks every notification read", async () => {
  renderBell(1);
  fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
  await screen.findByRole("menuitem", { name: /Your video failed/ });

  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/notifications/read",
    expect.objectContaining({ body: JSON.stringify({}) }),
  );
  expect(screen.queryByText("Unread")).toBeNull();
});

test("polls for new notifications", async () => {
  vi.useFakeTimers();
  renderBell(0);
  expect(fetchMock).not.toHaveBeenCalled();

  await act(() => vi.advanceTimersByTimeAsync(POLL_MS));

  expect(fetchMock).toHaveBeenCalledWith("/api/notifications");
  expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
});

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

// A background tab would ask every minute for a count nobody sees.
test("stops polling while the tab is hidden and catches up when it's back", async () => {
  vi.useFakeTimers();
  renderBell(0);

  act(() => setVisibility("hidden"));
  await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 3));
  expect(fetchMock).not.toHaveBeenCalled();

  act(() => setVisibility("visible"));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();

  await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("says so when there are no notifications", async () => {
  fetchMock.mockImplementationOnce(async () => Response.json({ notifications: [], unread: 0 }));
  renderBell(0);

  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

  expect(await screen.findByText("No notifications yet.")).toBeTruthy();
});
