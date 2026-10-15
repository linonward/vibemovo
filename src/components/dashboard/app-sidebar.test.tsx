import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { renderWithIntl } from "@/test/intl";
import { CreditsProvider } from "./credits";
import { AppSidebar } from "./app-sidebar";

let pathname = "/dashboard";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push() {} }),
  usePathname: () => pathname,
  Link: ({ href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={`/en${href}`} {...props} />
  ),
}));

beforeEach(() => {
  // jsdom has no media queries; render the desktop layout.
  window.matchMedia = vi.fn(
    () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as never,
  );
  pathname = "/dashboard";
});

afterEach(cleanup);

const user = { name: "Ada Lovelace", email: "ada@example.com", plan: null };

function renderSidebar(isAdmin: boolean) {
  renderWithIntl(
    <CreditsProvider balance={10}>
      <SidebarProvider>
        <AppSidebar user={user} isAdmin={isAdmin} />
      </SidebarProvider>
    </CreditsProvider>,
  );
  return screen.getByRole("navigation", { name: "Dashboard navigation" });
}

test("non-admins see no admin links", () => {
  const nav = renderSidebar(false);

  expect(within(nav).queryByRole("link", { name: "Admin" })).toBeNull();
  expect(within(nav).queryByRole("link", { name: "Users" })).toBeNull();
});

test("admins see the admin pages nested under Admin", () => {
  const nav = renderSidebar(true);

  // Admins send broadcasts; "Notifications" is the user's own inbox.
  expect(within(nav).getByRole("link", { name: "Broadcasts" }).getAttribute("href")).toBe(
    "/en/admin/notifications",
  );

  const admin = within(nav).getByRole("link", { name: "Admin" });
  const users = within(nav).getByRole("link", { name: "Users" });
  expect(admin.getAttribute("href")).toBe("/en/admin");
  expect(users.getAttribute("href")).toBe("/en/admin/users");
  expect(admin.closest("li")?.contains(users)).toBe(true);
});

test("on an admin page, the sub item is the current page and Admin stays highlighted", () => {
  pathname = "/admin/users";
  const nav = renderSidebar(true);

  const admin = within(nav).getByRole("link", { name: "Admin" });
  const users = within(nav).getByRole("link", { name: "Users" });
  expect(users.getAttribute("aria-current")).toBe("page");
  expect(admin.hasAttribute("aria-current")).toBe(false);
  expect(admin.hasAttribute("data-active")).toBe(true);
});

test("the image library sits under the image generator", () => {
  pathname = "/images/library";
  const nav = renderSidebar(false);

  const images = within(nav).getByRole("link", { name: "Image generator" });
  const library = within(nav).getByRole("link", { name: "All images" });
  expect(images.getAttribute("href")).toBe("/en/images");
  expect(library.getAttribute("href")).toBe("/en/images/library");
  expect(images.closest("li")?.contains(library)).toBe(true);
  expect(library.getAttribute("aria-current")).toBe("page");
  expect(images.hasAttribute("data-active")).toBe(true);
});

test("the video library sits under the video generator", () => {
  pathname = "/videos/library";
  const nav = renderSidebar(false);

  const videos = within(nav).getByRole("link", { name: "Video generator" });
  const library = within(nav).getByRole("link", { name: "All videos" });
  expect(videos.getAttribute("href")).toBe("/en/videos");
  expect(library.getAttribute("href")).toBe("/en/videos/library");
  expect(videos.closest("li")?.contains(library)).toBe(true);
  expect(library.getAttribute("aria-current")).toBe("page");
});

test("the rap duo sits under the video generator", () => {
  pathname = "/videos/rap";
  const nav = renderSidebar(false);

  const videos = within(nav).getByRole("link", { name: "Video generator" });
  const rap = within(nav).getByRole("link", { name: "Rap duo" });
  expect(rap.getAttribute("href")).toBe("/en/videos/rap");
  expect(videos.closest("li")?.contains(rap)).toBe(true);
  expect(rap.getAttribute("aria-current")).toBe("page");
});

test("the zombie couple sits under the video generator", () => {
  pathname = "/videos/zombie";
  const nav = renderSidebar(false);

  const videos = within(nav).getByRole("link", { name: "Video generator" });
  const zombie = within(nav).getByRole("link", { name: "Zombie couple" });
  expect(zombie.getAttribute("href")).toBe("/en/videos/zombie");
  expect(videos.closest("li")?.contains(zombie)).toBe(true);
  expect(zombie.getAttribute("aria-current")).toBe("page");
});

// The loading skeleton reads this attribute on the next full page load.
test("mirrors the collapsed state on <html> for the loading skeleton", () => {
  renderSidebar(false);
  const html = document.documentElement;
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);
});

test("one item opens credits and billing", () => {
  const nav = renderSidebar(false);

  expect(within(nav).queryByRole("link", { name: "Credits" })).toBeNull();
  expect(within(nav).getByRole("link", { name: "Credits & billing" }).getAttribute("href")).toBe(
    "/en/billing",
  );
});

test("groups the tools under Create, and billing and API keys under Account", () => {
  const nav = renderSidebar(false);

  const names = (group: string) =>
    within(within(nav).getByRole("list", { name: group }))
      .getAllByRole("link")
      .map((link) => link.textContent);
  expect(names("Create")).toEqual(["AI chat", "Image generator", "All images", "Video generator", "Rap duo", "Zombie couple", "All videos"]);
  expect(names("Account")).toEqual(["Credits & billing", "API keys"]);
  expect(within(nav).queryByRole("link", { name: "Feedback" })).toBeNull();
  // The dashboard home sits above the groups, without a label.
  expect(within(nav).getByRole("link", { name: "Dashboard" }).closest("ul")?.hasAttribute("aria-labelledby")).toBe(false);
});

test("group labels are translated", () => {
  renderWithIntl(
    <CreditsProvider balance={10}>
      <SidebarProvider>
        <AppSidebar user={user} isAdmin={false} />
      </SidebarProvider>
    </CreditsProvider>,
    "zh",
  );

  expect(screen.getByRole("list", { name: "创作" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "账户" })).toBeTruthy();
});

test("Profile opens from the user menu, not from the navigation", () => {
  const nav = renderSidebar(false);

  expect(within(nav).queryByRole("link", { name: "Profile" })).toBeNull();
});
