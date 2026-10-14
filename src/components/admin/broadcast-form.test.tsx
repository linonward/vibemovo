import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const { BroadcastForm } = await import("./broadcast-form");

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fill({ title = "Maintenance", body = "We restart at 02:00 UTC." } = {}) {
  renderWithIntl(<BroadcastForm maxTitle={100} maxBody={1000} />);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: body } });
}

test("asks before sending to every user, then sends and clears the form", async () => {
  fetchMock.mockResolvedValue(Response.json({ broadcast: { id: "b1", recipients: 42 } }));
  fill();

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const dialog = screen.getByRole("alertdialog");
  expect(dialog.textContent).toContain("Every user who has an account now gets it.");
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));

  expect(await screen.findByText("Sent to 42 users.")).toBeTruthy();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/admin/broadcasts");
  expect(JSON.parse(init.body)).toEqual({
    title: "Maintenance",
    body: "We restart at 02:00 UTC.",
    requestId: expect.any(String),
  });
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
  expect(refresh).toHaveBeenCalled();
});

test("sends to one user by email and reports an unknown email", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "UNKNOWN_USER" }, { status: 404 }));
  fill();
  fireEvent.click(screen.getByRole("radio", { name: "One user" }));
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("User's email"), { target: { value: "ada@example.com" } });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const dialog = screen.getByRole("alertdialog");
  expect(dialog.textContent).toContain("ada@example.com gets it.");
  fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));

  expect((await screen.findByRole("alert")).textContent).toBe("No user has this email.");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ email: "ada@example.com" });
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  // The text stays, so the admin can fix the email and retry.
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Maintenance");
});

test("can't send without a title and a message", () => {
  fill({ title: " " });

  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
});
