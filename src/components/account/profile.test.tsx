import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderWithIntl } from "@/test/intl";
import en from "../../../messages/en.json";

const push = vi.fn();
const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace }),
  Link: (props: React.ComponentProps<"a">) => <a {...props} />,
}));

const deleteUser = vi.fn();
const SESSION = {
  user: {
    name: "Ada",
    email: "ada@example.com",
    emailVerified: true,
    createdAt: new Date("2026-01-02"),
  },
};
// better-auth refetches the session after deleteUser; tests set it to null.
const auth = vi.hoisted(() => ({ session: null as unknown, pending: false }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ isPending: auth.pending, data: auth.session }),
    signOut: vi.fn(),
    deleteUser,
  },
}));

const { Profile } = await import("./profile");

beforeEach(() => {
  auth.session = SESSION;
  auth.pending = false;
});

afterEach(() => {
  cleanup();
  deleteUser.mockReset();
  push.mockReset();
  replace.mockReset();
});

test("shows the account details, without the balance or sign-out the account menu has", () => {
  renderWithIntl(<Profile />);

  expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
    "Name",
    "Email",
    "Email verified",
    "Member since",
  ]);
  expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
});

test("shows a skeleton until the session loads", () => {
  auth.session = null;
  auth.pending = true;
  renderWithIntl(<Profile />);

  const status = screen.getByRole("status", { name: "Loading…" });
  expect(status.textContent).toBe("");
});

async function confirmDelete() {
  renderWithIntl(<Profile />);
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete permanently" }));
  return dialog;
}

test("asks to sign in again, inside the dialog, when the session is too old", async () => {
  deleteUser.mockResolvedValue({
    data: null,
    error: { status: 400, code: "SESSION_EXPIRED" },
  });

  const dialog = await confirmDelete();

  expect((await within(dialog).findByRole("alert")).textContent).toBe(
    "For your security, sign in again before deleting your account.",
  );
  expect(push).not.toHaveBeenCalled();
});

test("asks to cancel the subscription first, linking to billing", async () => {
  deleteUser.mockResolvedValue({
    data: null,
    error: { status: 400, code: "ACTIVE_SUBSCRIPTION" },
  });

  const dialog = await confirmDelete();

  const alert = await within(dialog).findByRole("alert");
  expect(alert.textContent).toBe("Cancel your subscription on the Credits & billing page before deleting your account.");
  expect(within(alert).getByRole("link", { name: "Credits & billing" }).getAttribute("href")).toBe("/billing");
  expect(push).not.toHaveBeenCalled();
});

test("cancel closes the dialog without deleting", async () => {
  renderWithIntl(<Profile />);
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(deleteUser).not.toHaveBeenCalled();
});

test("after deleting, goes home and not to sign-in when the session clears", async () => {
  deleteUser.mockImplementation(async () => {
    auth.session = null;
    return { data: { success: true }, error: null };
  });
  const { rerender } = renderWithIntl(<Profile />);
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete permanently" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  // The session hook re-renders with no session.
  rerender(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <Profile />
    </NextIntlClientProvider>,
  );

  expect(replace).not.toHaveBeenCalled();
});
