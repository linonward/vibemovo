import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/auth";

// One visual system across pages (docs/DESIGN.md): dark by default with an
// opt-in light theme, pine primary, 12px radius, Martian Mono headings
// (heavy Geist page titles in the dashboard),
// Lucide icons at 1.75 stroke.

// The browser may serialize colors as oklch() or lab(); compare against
// what it computes for the primary token instead of a literal.
async function primaryColor(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--primary)";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
}

// The theme switch in the footer.
const themeButton = (page: Page, name: string, group = "Theme") =>
  page.getByRole("contentinfo").getByRole("group", { name: group }).getByRole("button", { name });

test("sign-in uses the shared visual system", async ({ page }) => {
  await page.goto("/en/sign-in");

  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "font-family",
    /Martian Mono/,
  );
  const submit = page.getByRole("button", { name: "Send magic link" });
  await expect(submit).toHaveCSS("border-top-left-radius", "12px");
  await expect(submit).toHaveCSS("background-color", await primaryColor(page));
  await expect(submit.locator("svg.lucide").first()).toHaveCSS("stroke-width", "1.75px");
  await expect(page.getByLabel("Email")).toHaveCSS("border-top-left-radius", "12px");
});

test("profile uses the shared visual system", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/profile");

  // Dashboard titles are heavy Geist, not mono (docs/DESIGN.md, Dashboard).
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveCSS("font-family", /^Geist/);
  await expect(title).toHaveCSS("font-weight", "900");
  await expect(page.getByText("Your account details.")).toBeVisible();
  const remove = page.getByRole("main").getByRole("button", { name: "Delete account" });
  await expect(remove).toHaveCSS("border-top-left-radius", "12px");
  await expect(remove.locator("svg.lucide")).toBeVisible();
});

test("dark is the default and the light choice survives a reload", async ({ page }) => {
  await page.goto("/en");
  const html = page.locator("html");
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(13, 13, 13)");

  await themeButton(page, "Light").click();
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 247, 243)");

  await page.goto("/en/sign-in");
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(themeButton(page, "Light")).toHaveAttribute("aria-pressed", "true");
});

test("the light choice survives a language switch", async ({ page }) => {
  await page.goto("/en");
  await themeButton(page, "Light").click();

  // A language switch re-mounts the root layout on the client.
  await page.getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("menuitem", { name: "中文" }).click();
  await expect(page).toHaveURL("/zh");
  await expect(themeButton(page, "浅色", "主题")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 247, 243)");
});

test("system follows the operating system, also while the page is open", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/en");
  const body = page.locator("body");

  await themeButton(page, "System").click();
  await expect(body).toHaveCSS("background-color", "rgb(247, 247, 243)");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(body).toHaveCSS("background-color", "rgb(13, 13, 13)");

  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(body).toHaveCSS("background-color", "rgb(247, 247, 243)");
  await expect(themeButton(page, "System")).toHaveAttribute("aria-pressed", "true");
});

test("the account menu switches the theme", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/dashboard");

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});

test("landing uses Lucide icons and a pine primary action", async ({ page }) => {
  await page.goto("/en");

  const cta = page.getByRole("link", { name: "Start creating free" }).first();
  await expect(cta).toHaveCSS("background-color", await primaryColor(page));
  await expect(cta.locator("svg.lucide-arrow-right")).toBeVisible();
});

test("FAQ plus icon turns into a close mark when open", async ({ page }) => {
  await page.goto("/en");

  const item = page.locator("details").filter({ hasText: "Do I need a password?" });
  const icon = item.locator("summary svg.lucide-plus");
  await expect(icon).toHaveCSS("transform", "none");
  await item.locator("summary").click();
  await expect(icon).not.toHaveCSS("transform", "none");
});

for (const width of [320, 375]) {
  for (const path of ["/en/sign-in", "/zh/sign-in"]) {
    test(`${path} fits ${width}px without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(path);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("profile fits 320px without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await signIn(page);
  await page.goto("/zh/profile");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
