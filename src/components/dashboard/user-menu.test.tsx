import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { CreditsProvider } from "./credits";
import { UserMenu } from "./user-menu";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  Link: ({
    href,
    locale,
    ...props
  }: React.ComponentProps<"a"> & { href: string; locale?: string }) => (
    <a href={`/${locale ?? "en"}${href}`} {...props} />
  ),
}));

const signOut = vi.fn();
// Set when the menu first loads the auth client.
const authClient = vi.hoisted(() => ({ loaded: false }));
vi.mock("@/lib/auth-client", () => {
  authClient.loaded = true;
  return { authClient: { signOut: () => signOut() } };
});

beforeEach(() => {
  // jsdom has no media queries; render the desktop layout.
  window.matchMedia = vi.fn(
    () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as never,
  );
  localStorage.clear();
  document.documentElement.className = "dark";
  push.mockClear();
  signOut.mockReset().mockResolvedValue({});
});

afterEach(cleanup);

const user = { name: "Ada Lovelace", email: "ada@example.com", plan: null };

const withCredits = (ui: React.ReactElement) => <CreditsProvider balance={10}>{ui}</CreditsProvider>;

function open(props: Partial<typeof user> = {}, locale: "en" | "zh" = "en") {
  renderWithIntl(withCredits(<UserMenu {...user} {...props} />), locale);
  fireEvent.click(screen.getByRole("button", { name: /Account menu|账户菜单/ }));
}

test("the trigger shows the user's initial and email", () => {
  renderWithIntl(<UserMenu {...user} />);

  const trigger = screen.getByRole("button", { name: "Account menu" });
  expect(trigger.textContent).toContain("A");
  expect(trigger.textContent).toContain("ada@example.com");
});

test("the menu shows the profile, the plan and the balance", async () => {
  open();

  const menu = await screen.findByRole("menu");
  expect(menu.textContent).toContain("Ada Lovelace");
  expect(menu.textContent).toContain("Free");
  expect(screen.getByRole("menuitem", { name: "10 credits left" }).getAttribute("href")).toBe(
    "/en/billing",
  );
});

test("a subscriber sees the plan name", async () => {
  open({ plan: "pro" } as never);

  expect((await screen.findByRole("menu")).textContent).toContain("Pro");
});

test("links to upgrade and the profile", async () => {
  open();

  expect((await screen.findByRole("menuitem", { name: "Upgrade" })).getAttribute("href")).toBe(
    "/en/billing",
  );
  expect(screen.getByRole("menuitem", { name: "Profile" }).getAttribute("href")).toBe(
    "/en/profile",
  );
});

test("a subscriber manages the subscription instead of upgrading", async () => {
  open({ plan: "pro" } as never);

  const manage = await screen.findByRole("menuitem", { name: "Manage subscription" });
  expect(manage.getAttribute("href")).toBe("/en/billing");
  expect(screen.queryByRole("menuitem", { name: "Upgrade" })).toBeNull();
});

test("switches the language on the current page", async () => {
  open();

  fireEvent.click(await screen.findByRole("menuitem", { name: "Language: English" }));

  expect((await screen.findByRole("menuitem", { name: "中文" })).getAttribute("href")).toBe(
    "/zh/dashboard",
  );
});

test("switches the theme without closing the menu", async () => {
  open();

  expect(
    (await screen.findByRole("menuitemradio", { name: "Dark" })).getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));

  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(localStorage.getItem("theme")).toBe("light");
  await waitFor(() =>
    expect(
      screen.getByRole("menuitemradio", { name: "Light" }).getAttribute("aria-checked"),
    ).toBe("true"),
  );
  expect(screen.getByRole("menu")).toBeTruthy();
});

test("offers the system theme", async () => {
  open();

  fireEvent.click(await screen.findByRole("menuitemradio", { name: "System" }));

  expect(localStorage.getItem("theme")).toBe("system");
});

// Every dashboard page shows the menu; only signing out needs Better Auth's
// client. The module stays loaded afterwards, so no test may sign out first.
test("signs out, loading the auth client only then", async () => {
  open();
  expect(authClient.loaded).toBe(false);

  fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/sign-in"));
  expect(signOut).toHaveBeenCalled();
  expect(authClient.loaded).toBe(true);
});

test("is translated", async () => {
  open({}, "zh");

  expect((await screen.findByRole("menu")).textContent).toContain("免费版");
  expect(screen.getByRole("menuitem", { name: "10 剩余积分" })).toBeTruthy();
});
