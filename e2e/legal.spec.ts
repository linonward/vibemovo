import { expect, test } from "@playwright/test";

const pages = [
  { path: "/en/privacy", heading: "Privacy Policy" },
  { path: "/en/terms", heading: "Terms of Service" },
  { path: "/en/refund", heading: "Refund Policy" },
  { path: "/zh/privacy", heading: "隐私政策" },
  { path: "/zh/terms", heading: "服务条款" },
  { path: "/zh/refund", heading: "退款政策" },
];

for (const { path, heading } of pages) {
  test(`${path} renders the ${heading} template`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveTitle(`${heading} · vibemovo`);
    await expect(
      page.getByRole("main").getByRole("link", { name: "support@example.com" }),
    ).toHaveAttribute("href", "mailto:support@example.com");
  });
}

test("footer links to the legal pages in the current locale", async ({ page }) => {
  await page.goto("/zh");

  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "退款政策" }).click();

  await expect(page).toHaveURL("/zh/refund");
  await expect(footer.getByRole("link", { name: "support@example.com" })).toBeVisible();
});

test("legal pages share the visual system", async ({ page }) => {
  await page.goto("/en/privacy");

  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "font-family",
    /Martian Mono/,
  );
  await expect(page.getByRole("note").locator("svg.lucide")).toBeVisible();
});

test("document nav marks the current page and switches documents", async ({
  page,
}) => {
  await page.goto("/en/privacy");

  const nav = page.getByRole("navigation", { name: "Legal documents" });
  await expect(nav.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await nav.getByRole("link", { name: "Terms of Service" }).click();

  await expect(page).toHaveURL("/en/terms");
  await expect(
    page
      .getByRole("navigation", { name: "Legal documents" })
      .getByRole("link", { name: "Terms of Service" }),
  ).toHaveAttribute("aria-current", "page");
});

for (const width of [320, 375]) {
  test(`/zh/privacy fits ${width}px without horizontal scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/zh/privacy");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
