import { expect, test } from "@playwright/test";

// Each effect page links two related guides where the locale has them.
for (const [path, guides] of [
  ["/ai-zombie-couple-video", ["/blog/hug-your-younger-self-ai", "/blog/ai-vampire-transformation-video"]],
  ["/hug-your-younger-self-ai", ["/blog/ai-zombie-couple-video", "/blog/photo-to-video-ai"]],
  ["/ai-vampire-transformation-video", ["/blog/ai-zombie-couple-video", "/blog/photo-to-video-ai"]],
  ["/raindance-ai-trend", ["/blog/ai-zombie-couple-video", "/blog/ai-rap-video-two-people"]],
] as const) {
  test(`${path} links its related guides`, async ({ page }) => {
    await page.goto(`/en${path}`);
    const more = page.getByRole("main").getByRole("region", { name: "More AI video effects" });
    const hrefs = await more.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs.slice(4).sort()).toEqual(guides.map((guide) => `/en${guide}`).sort());

    await page.goto(`/zh${path}`);
    await expect(page.getByRole("main").getByRole("region", { name: "更多 AI 视频特效" }).getByRole("link")).toHaveCount(4);
  });
}
