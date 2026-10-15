import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

// The form in the hero (landing-tryout.test.tsx covers it) reads the session.
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: null, isPending: false }) } }));
vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

const { RapLanding } = await import("./rap-landing");

afterEach(cleanup);

const facts = {
  credits: 75,
  signup: 75,
  maxImageBytes: 2 * 1024 * 1024,
  imageLimits: { minSide: 240, maxSide: 8000, maxRatio: 8 },
  maxNameLength: 30,
};

test("the headline names the query and is the page's only h1", () => {
  renderWithIntl(<RapLanding facts={facts} guide="/blog/ai-rap-video-two-people" />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name: "AI rap video generator from photos" })).toBeDefined();
});

test("the hero holds the rap duo's form, and the closing call to action leads back to it", () => {
  renderWithIntl(<RapLanding facts={facts} guide="/blog/ai-rap-video-two-people" />);

  const form = screen.getByRole("region", { name: "Try it now" });
  expect(form.id).toBe("try");
  for (const label of ["Left photo", "Right photo", "Left name", "Right name"]) {
    expect(within(form).getByLabelText(label)).toBeDefined();
  }
  expect(screen.getByRole("link", { name: /Make a rap video/ }).getAttribute("href")).toBe("#try");
});

test("links the guide when the locale has one", () => {
  renderWithIntl(<RapLanding facts={facts} guide="/blog/ai-rap-video-two-people" />);
  expect(screen.getByRole("link", { name: "Read the guide" }).getAttribute("href")).toBe(
    "/en/blog/ai-rap-video-two-people",
  );
  cleanup();

  renderWithIntl(<RapLanding facts={facts} />, "zh");
  expect(screen.queryByRole("link", { name: "阅读教程" })).toBeNull();
});

test("shows a real result and the real cost", () => {
  renderWithIntl(<RapLanding facts={facts} />);

  const video = screen.getByLabelText(/A real 15-second AI rap video/) as HTMLVideoElement;
  expect(video.tagName).toBe("VIDEO");
  expect(video.getAttribute("src")).toBe("/landing/rap/sample.mp4");
  expect(video.getAttribute("poster")).toBe("/landing/rap/poster.jpg");
  expect(video.muted && video.loop && video.autoplay && video.controls).toBe(true);
  expect(video.hasAttribute("playsinline")).toBe(true);
  expect(screen.getByText(/One video costs 75 credits/)).toBeDefined();
  expect(screen.getByText(/New accounts get 75 free credits, enough for your first/)).toBeDefined();
  expect(screen.getByRole("link", { name: "pricing page" }).getAttribute("href")).toBe("/en/pricing");
});

test("renders in Chinese", () => {
  renderWithIntl(<RapLanding facts={facts} />, "zh");

  expect(screen.getByRole("heading", { level: 1, name: "AI 说唱视频生成器，用照片就能做" })).toBeDefined();
});

const related = [{ href: "/blog/hotel-lobby-rap-duo-video", title: "Hotel Lobby Rap Duo: AI Song & Video from Photos" }];

test("covers ideas, photo tips and the common questions", () => {
  renderWithIntl(<RapLanding facts={facts} guide="/blog/ai-rap-video-two-people" related={related} />);

  expect(screen.getByRole("heading", { level: 2, name: "Rap videos for the people in your life" })).toBeDefined();
  expect(screen.getByRole("heading", { level: 2, name: "Photos that work" })).toBeDefined();
  const faq = screen.getByRole("region", { name: "AI rap video questions" });
  expect(within(faq).getAllByRole("term")).toHaveLength(8);
  expect(within(faq).getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/en/terms");
  expect(within(faq).getByText(/16:9 MP4, 1280×720/)).toBeDefined();
});

test("links the other effects and the locale's related guides", () => {
  renderWithIntl(<RapLanding facts={facts} related={related} />);

  const more = screen.getByRole("region", { name: "More AI video effects" });
  expect(within(more).getByRole("link", { name: /Zombie couple/ }).getAttribute("href")).toBe("/en/ai-zombie-couple-video");
  expect(within(more).getByRole("link", { name: /Younger-self hug/ }).getAttribute("href")).toBe("/en/hug-your-younger-self-ai");
  expect(within(more).getByRole("link", { name: /Vampire transformation/ }).getAttribute("href")).toBe(
    "/en/ai-vampire-transformation-video",
  );
  expect(within(more).getByRole("link", { name: /Hotel Lobby Rap Duo/ }).getAttribute("href")).toBe(
    "/en/blog/hotel-lobby-rap-duo-video",
  );
});
