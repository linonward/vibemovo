import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { LocaleSwitcher } from "./locale-switcher";

// A third locale shows the menu doesn't assume two languages.
vi.mock("@/i18n/routing", async () => {
  const { defineRouting } = await import("next-intl/routing");
  return {
    routing: defineRouting({ locales: ["en", "zh", "ja"], defaultLocale: "en" }),
    LOCALE_NAMES: { en: "English", zh: "中文", ja: "日本語" },
  };
});

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/en/sign-in",
}));

afterEach(cleanup);

test("the button names the current language", () => {
  renderWithIntl(<LocaleSwitcher />);

  expect(screen.getByRole("button", { name: "Language: English" })).toBeTruthy();
});

test("lists every language and keeps the page", async () => {
  renderWithIntl(<LocaleSwitcher />);

  fireEvent.click(screen.getByRole("button", { name: "Language: English" }));

  const items = await screen.findAllByRole("menuitem");
  expect(items.map((item) => [item.textContent, item.getAttribute("href")])).toEqual([
    ["English", "/en/sign-in"],
    ["中文", "/zh/sign-in"],
    ["日本語", "/ja/sign-in"],
  ]);
  expect(items[0].getAttribute("aria-current")).toBe("true");
  expect(items[1].getAttribute("lang")).toBe("zh");
});
