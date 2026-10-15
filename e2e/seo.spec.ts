import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

// Search engines find the public pages in every locale, and nothing behind
// sign-in or the API.
test("the sitemap lists the public pages in every locale", async ({ request, baseURL }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.status()).toBe(200);
  const xml = await response.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const pages = ["", "/privacy", "/terms", "/refund", "/pricing", "/ai-rap-video-generator", "/ai-zombie-couple-video", "/hug-your-younger-self-ai", "/ai-vampire-transformation-video", "/raindance-ai-trend", "/blog"];
  expect(locs.sort()).toEqual(
    [
      ...pages.flatMap((page) => [`${baseURL}/en${page}`, `${baseURL}/zh${page}`]),
      // English only, so no Chinese entry.
      `${baseURL}/en/blog/ai-rap-video-two-people`,
      `${baseURL}/en/blog/ai-vampire-transformation-video`,
      `${baseURL}/en/blog/ai-zombie-couple-video`,
      `${baseURL}/en/blog/hug-your-younger-self-ai`,
      `${baseURL}/en/blog/hotel-lobby-rap-duo-video`,
      `${baseURL}/en/blog/photo-to-video-ai`,
    ].sort(),
  );
  expect(xml).toContain(`hreflang="zh" href="${baseURL}/zh/privacy"`);
  expect(xml).toContain(`hreflang="x-default" href="${baseURL}/en/privacy"`);
});

test("robots.txt keeps crawlers out of the API and points to the sitemap", async ({ request, baseURL }) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);
  const robots = await response.text();
  expect(robots).toContain("User-Agent: *");
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
});

test("a post names its canonical URL and only the translations that exist", async ({ page, baseURL }) => {
  await page.goto("/en/blog/photo-to-video-ai");

  const head = page.locator("head");
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", `${baseURL}/en/blog/photo-to-video-ai`);
  await expect(head.locator('link[rel="alternate"][hreflang="zh"]')).toHaveCount(0);
  await expect(head.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
});

test("a post describes itself to search engines as a BlogPosting", async ({ page, baseURL }) => {
  await page.goto("/en/blog/photo-to-video-ai");

  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(data).toMatchObject({
    "@type": "BlogPosting",
    headline: "How to Turn a Photo into a Video with AI",
    datePublished: "2026-10-14",
    keywords: ["guides", "video"],
    inLanguage: "en",
    url: `${baseURL}/en/blog/photo-to-video-ai`,
  });
  // Only what the page shows: the same title and description.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(data.headline);
  await expect(page.getByText(data.description)).toBeVisible();
});

test("the home page names the site and its publisher", async ({ page, baseURL }) => {
  await page.goto("/zh");

  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(data["@graph"]).toEqual([
    expect.objectContaining({ "@type": "Organization", name: "vibemovo", url: `${baseURL}/` }),
    expect.objectContaining({
      "@type": "WebSite",
      name: "vibemovo",
      inLanguage: "zh",
      url: `${baseURL}/`,
      description: await page.locator('head meta[name="description"]').getAttribute("content"),
    }),
  ]);
});

test("the blog index names its canonical URL and every locale", async ({ page, baseURL }) => {
  await page.goto("/zh/blog");

  const head = page.locator("head");
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", `${baseURL}/zh/blog`);
  await expect(head.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", `${baseURL}/en/blog`);
  await expect(head.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", `${baseURL}/en/blog`);
});

test("the home, legal and rap video pages name their canonical URL and every locale", async ({ page, baseURL }) => {
  for (const path of ["", "/privacy", "/terms", "/refund", "/ai-rap-video-generator", "/ai-zombie-couple-video", "/hug-your-younger-self-ai", "/ai-vampire-transformation-video", "/raindance-ai-trend"]) {
    await page.goto(`/zh${path}`);

    const head = page.locator("head");
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", `${baseURL}/zh${path}`);
    await expect(head.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", `${baseURL}/en${path}`);
    await expect(head.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      "href",
      `${baseURL}/en${path}`,
    );
  }
});

// Search titles lead with the keyword and end with the brand.
test("marketing pages carry keyword-first titles", async ({ page }) => {
  const titles = {
    "/en/ai-rap-video-generator": "AI Rap Video Generator: Two Photos to a Rap Video | vibemovo",
    "/zh": "AI 爆款视频模板：用照片一键做视频 | vibemovo",
    "/zh/pricing": "AI 视频生成器价格：积分包与订阅方案 | vibemovo",
    "/zh/blog": "AI 视频教程：照片变视频与说唱视频 | vibemovo",
    "/zh/ai-rap-video-generator": "AI 说唱视频生成器：用照片做说唱视频 | vibemovo",
    "/en/ai-zombie-couple-video": "AI Zombie Couple Video: Photos to a Love Story | vibemovo",
    "/zh/ai-zombie-couple-video": "AI 僵尸情侣视频：两张照片变末日爱情故事 | vibemovo",
    "/en/hug-your-younger-self-ai": "Hug Your Younger Self AI: Photos to a Hug Video | vibemovo",
    "/zh/hug-your-younger-self-ai": "AI 拥抱童年的自己：两张照片生成拥抱视频 | vibemovo",
    "/en/ai-vampire-transformation-video": "AI Vampire Transformation: One Photo to Video | vibemovo",
    "/zh/ai-vampire-transformation-video": "AI 吸血鬼变身：一张照片生成万圣节视频 | vibemovo",
    "/en/raindance-ai-trend": "Raindance AI Trend: Two Photos to the Dock Video | vibemovo",
    "/zh/raindance-ai-trend": "Raindance AI 热梗：两张照片生成码头唱歌视频 | vibemovo",
  };
  for (const [path, title] of Object.entries(titles)) {
    await page.goto(path);

    await expect(page, path).toHaveTitle(title);
  }
});

// The page's own hreflang links are the only ones. A Link header would also
// name translations that don't exist, such as a Chinese photo-to-video-ai.
test("responses carry no hreflang Link header", async ({ request }) => {
  for (const path of ["/en", "/en/pricing", "/en/blog/photo-to-video-ai"]) {
    const response = await request.get(path);

    expect(response.headers().link ?? "", path).not.toContain("hreflang");
  }
});

// Each page's own summary, not the site's: search results show it under the title.
test("the legal, sign-in, tag and rap video pages describe themselves", async ({ page }) => {
  const descriptions = {
    "/en/privacy": "How vibemovo collects, uses, shares and protects your personal information.",
    "/zh/terms": "使用 vibemovo 的条款：你的账户、可接受的使用、你的内容和付款。",
    "/en/refund": "When vibemovo refunds a purchase, and how to ask for a refund.",
    "/en/sign-in": "No password to remember. We email you a link, or you continue with Google.",
    "/en/blog/tags/guides": "Every post tagged “guides”, newest first.",
    "/en/ai-rap-video-generator":
      "Turn two photos and two names into a 15-second rap video. vibemovo writes the lyrics and makes the beat, the vocals and the lip sync.",
    "/en/ai-zombie-couple-video":
      "Turn two photos into a 15-second zombie love story: your partner turns zombie, you drop the bat and hug them. Vertical 9:16 video with music.",
  };
  for (const [path, description] of Object.entries(descriptions)) {
    await page.goto(path);

    await expect(page.locator('head meta[name="description"]'), path).toHaveAttribute("content", description);
  }
});

test("the sign-in page stays out of search results", async ({ page }) => {
  await page.goto("/en/sign-in?next=%2Fen%2Fdashboard");

  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", "noindex");
});

// Signed-out crawlers get redirected to sign-in, but a signed-in page still
// says noindex in case that redirect ever fails.
test("signed-in pages stay out of search results", async ({ page }) => {
  await signIn(page);

  for (const path of ["/en/dashboard", "/en/images", "/en/videos", "/en/billing"]) {
    await page.goto(path);

    await expect(page.locator('head meta[name="robots"]'), path).toHaveAttribute("content", "noindex");
  }
});

// A crawler's first request decides the status. Next.js caches the 404
// afterwards, so each run asks for paths no earlier request has seen.
test("an unknown post, tag or translation answers 404 on the first request", async ({ request }) => {
  const unseen = `unseen-${Date.now()}`;
  for (const path of [`/en/blog/${unseen}`, `/en/blog/tags/${unseen}`, `/zh/blog/photo-to-video-ai`]) {
    const response = await request.get(path);

    expect(response.status(), path).toBe(404);
  }
});

test("llms.txt describes the product and links the public pages", async ({ request, baseURL }) => {
  const response = await request.get("/llms.txt");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
  const text = await response.text();
  const lines = text.split("\n");
  expect(lines[0]).toBe("# vibemovo");
  expect(lines[2]).toBe(
    "> Turn your photos into viral AI videos: rap duos, zombie couples, younger-self hugs and vampire transformations. Start free with sign-up credits.",
  );
  expect(text).toContain("- Text to image: Write what you want to see.");
  expect(text).toContain("- Image to video: Upload a photo or use one you made.");
  expect(text).toContain("- How do I contact support?: Email support@vibemovo.com.");
  expect(text).toContain(`- [Privacy Policy](${baseURL}/en/privacy)`);
  expect(text).toContain(`- [隐私政策](${baseURL}/zh/privacy)`);
  expect(text).toContain(`- [Pricing](${baseURL}/en/pricing): Pay with credits`);
  expect(text).toContain(`- [AI Rap Video Generator from Photos](${baseURL}/en/ai-rap-video-generator): Turn two photos`);
  expect(text).toContain(`- [AI Zombie Couple Video Generator](${baseURL}/en/ai-zombie-couple-video): Turn two photos`);
  expect(text).toContain(`- [Hug Your Younger Self AI Video Generator](${baseURL}/en/hug-your-younger-self-ai): Turn a photo`);
  expect(text).toContain(`- [AI Vampire Transformation Video Generator](${baseURL}/en/ai-vampire-transformation-video): Turn one photo`);
  expect(text).toContain(`- [Raindance AI Trend Video Generator](${baseURL}/en/raindance-ai-trend): Turn two photos`);
  expect(text).toContain(`- [Blog](${baseURL}/en/blog): `);
  expect(text).toContain(`](${baseURL}/en/blog/photo-to-video-ai): `);
  expect(text).not.toContain(`${baseURL}/zh/blog/photo-to-video-ai`);
  expect(text).toContain(`- [Sitemap](${baseURL}/sitemap.xml)`);
  // No ICU or markup left over.
  expect(text).not.toMatch(/[{}]|<\/?\w/);
});

// Links shared in chats and on social sites show a preview image.
// It shows a real result, so a shared link previews what the page makes.
test("the rap video and zombie couple pages share preview images of their own", async ({ page, request, baseURL }) => {
  for (const [path, alt] of [
    ["/en/ai-rap-video-generator", "AI Rap Video Generator from Photos"],
    ["/zh/ai-rap-video-generator", "AI 说唱视频生成器：用照片做说唱视频"],
    ["/en/ai-zombie-couple-video", "AI Zombie Couple Video Generator"],
    ["/zh/ai-zombie-couple-video", "AI 僵尸情侣视频生成器"],
    ["/en/hug-your-younger-self-ai", "Hug Your Younger Self AI Video Generator"],
    ["/en/ai-vampire-transformation-video", "AI Vampire Transformation Video Generator"],
    ["/en/raindance-ai-trend", "Raindance AI Trend Video Generator"],
  ]) {
    await page.goto(path);

    const head = page.locator("head");
    await expect(head.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", alt);
    const image = await head.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toContain(`${baseURL}${path}/opengraph-image`);
    const response = await request.get(image!);
    expect(response.status(), image!).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test("every public page shares a preview image", async ({ page, request }) => {
  for (const path of ["/en", "/zh/pricing", "/en/blog"]) {
    await page.goto(path);

    const head = page.locator("head");
    await expect(head.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(head.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    const image = await head.locator('meta[property="og:image"]').getAttribute("content");
    const response = await request.get(image!);
    expect(response.status(), image!).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test("a post shares a preview image of its own", async ({ page, request, baseURL }) => {
  for (const path of ["/en/blog/photo-to-video-ai", "/en/blog/ai-rap-video-two-people"]) {
    await page.goto(path);

    const image = await page.locator('head meta[property="og:image"]').getAttribute("content");
    expect(image).toContain(`${baseURL}${path}/opengraph-image`);
    const response = await request.get(image!);
    expect(response.status(), image!).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test("home pages identify the same site in social metadata", async ({ page, baseURL }) => {
  for (const locale of ["en", "zh"]) {
    await page.goto(`/${locale}`);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "vibemovo");
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `${baseURL}/${locale}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", await page.title());
  }
});
