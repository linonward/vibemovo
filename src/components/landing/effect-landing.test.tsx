import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

// The form in the hero (landing-tryout.test.tsx covers it) reads the session.
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: null, isPending: false }) } }));
vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

const { EffectLanding } = await import("./effect-landing");

afterEach(cleanup);

const facts = {
  credits: 75,
  signup: 75,
  maxImageBytes: 2 * 1024 * 1024,
  imageLimits: { minSide: 240, maxSide: 8000, maxRatio: 8 },
};

test("the headline names the query and is the page's only h1", () => {
  renderWithIntl(<EffectLanding kind="zombie" facts={facts} guide="/blog/ai-zombie-couple-video" />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name: "AI zombie couple video from two photos" })).toBeDefined();
});

test("the hero holds the effect's form, and the closing call to action leads back to it", () => {
  renderWithIntl(<EffectLanding kind="zombie" facts={facts} />);

  const form = screen.getByRole("region", { name: "Try it now" });
  expect(form.id).toBe("try");
  expect(screen.getByLabelText("Your photo")).toBeDefined();
  expect(screen.getByLabelText("Your partner's photo")).toBeDefined();
  expect(screen.getByRole("link", { name: /Make a zombie couple video/ }).getAttribute("href")).toBe("#try");
  expect(screen.queryByRole("link", { name: /sign-in/ })).toBeNull();
});

test("links the guide when the locale has one", () => {
  renderWithIntl(<EffectLanding kind="zombie" facts={facts} guide="/blog/ai-zombie-couple-video" />);
  expect(screen.getByRole("link", { name: "Read the guide" }).getAttribute("href")).toBe(
    "/en/blog/ai-zombie-couple-video",
  );
  cleanup();

  renderWithIntl(<EffectLanding kind="zombie" facts={facts} />, "zh");
  expect(screen.queryByRole("link", { name: "阅读教程" })).toBeNull();
});

test("shows a real result and the real cost", () => {
  renderWithIntl(<EffectLanding kind="zombie" facts={facts} />);

  expect(screen.getByRole("img", { name: /Four frames from a 15-second AI zombie couple video/ })).toBeDefined();
  const video = screen.getByLabelText(/A real 15-second AI zombie couple video/) as HTMLVideoElement;
  expect(video.tagName).toBe("VIDEO");
  expect(video.getAttribute("src")).toBe("/landing/zombie/sample.mp4");
  expect(video.getAttribute("poster")).toBe("/landing/zombie/poster.jpg");
  expect(video.muted && video.loop && video.autoplay && video.controls).toBe(true);
  expect(video.hasAttribute("playsinline")).toBe(true);
  expect(screen.getByText(/One video costs 75 credits/)).toBeDefined();
  expect(screen.getByText(/New accounts get 75 free credits, enough for your first/)).toBeDefined();
  expect(screen.getByRole("link", { name: "pricing page" }).getAttribute("href")).toBe("/en/pricing");
});

test("renders in Chinese", () => {
  renderWithIntl(<EffectLanding kind="zombie" facts={facts} />, "zh");

  expect(screen.getByRole("heading", { level: 1, name: "AI 僵尸情侣视频，两张照片就能做" })).toBeDefined();
});

test.each([
  ["hug", "Hug your younger self with AI, from two photos", /Make a younger-self hug video/, "Your childhood photo", /Four frames from a 15-second AI younger-self hug video/, /A real 15-second AI younger-self hug video/],
  ["vampire", "AI vampire transformation video from one photo", /Make a vampire video/, "Your photo", /Four frames from a 10-second AI vampire transformation video/, /A real 10-second AI vampire transformation video/],
] as const)("the %s page names its query, shows a real result and its own form", (kind, h1, cta, photo, alt, video) => {
  renderWithIntl(<EffectLanding kind={kind} facts={facts} />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name: h1 })).toBeDefined();
  expect(screen.getByRole("img", { name: alt })).toBeDefined();
  expect(screen.getByLabelText(video).getAttribute("src")).toBe(`/landing/${kind}/sample.mp4`);
  expect(screen.getByLabelText(photo)).toBeDefined();
  expect(screen.getByRole("link", { name: cta }).getAttribute("href")).toBe("#try");
  expect(screen.getByText(/New accounts get 75 free credits, enough for your first/)).toBeDefined();
});

test.each([
  ["hug", "用 AI 拥抱童年的自己，两张照片就能做"],
  ["vampire", "AI 吸血鬼变身视频，一张照片就能做"],
] as const)("the %s page renders in Chinese", (kind, h1) => {
  renderWithIntl(<EffectLanding kind={kind} facts={facts} />, "zh");

  expect(screen.getByRole("heading", { level: 1, name: h1 })).toBeDefined();
});
