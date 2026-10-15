import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { EffectLanding } from "./effect-landing";

afterEach(cleanup);

const facts = { credits: 75, signup: 75, maxImageMb: 2 };

test("the headline names the query and is the page's only h1", () => {
  renderWithIntl(<EffectLanding kind="zombie" facts={facts} guide="/blog/ai-zombie-couple-video" />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name: "AI zombie couple video from two photos" })).toBeDefined();
});

test("both calls to action sign in and return to the zombie couple page", () => {
  renderWithIntl(<EffectLanding kind="zombie" facts={facts} />);

  const links = screen.getAllByRole("link", { name: /Make a zombie couple video/ });
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/en/sign-in?next=%2Fen%2Fvideos%2Fzombie",
    "/en/sign-in?next=%2Fen%2Fvideos%2Fzombie",
  ]);
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
  expect(screen.getByText(/One video costs 75 credits/)).toBeDefined();
  expect(screen.getByText(/New accounts get 75 free credits, enough for your first/)).toBeDefined();
  expect(screen.getByRole("link", { name: "pricing page" }).getAttribute("href")).toBe("/en/pricing");
});

test("renders in Chinese", () => {
  renderWithIntl(<EffectLanding kind="zombie" facts={facts} />, "zh");

  expect(screen.getByRole("heading", { level: 1, name: "AI 僵尸情侣视频，两张照片就能做" })).toBeDefined();
});

test.each([
  ["hug", "Hug your younger self with AI, from two photos", /Make a younger-self hug video/, "hug", /Four frames from a 15-second AI younger-self hug video/],
  ["vampire", "AI vampire transformation video from one photo", /Make a vampire video/, "vampire", /Four frames from a 10-second AI vampire transformation video/],
] as const)("the %s page names its query, shows a real result and returns to its tool", (kind, h1, cta, tool, alt) => {
  renderWithIntl(<EffectLanding kind={kind} facts={facts} />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name: h1 })).toBeDefined();
  expect(screen.getByRole("img", { name: alt })).toBeDefined();
  const links = screen.getAllByRole("link", { name: cta });
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    `/en/sign-in?next=%2Fen%2Fvideos%2F${tool}`,
    `/en/sign-in?next=%2Fen%2Fvideos%2F${tool}`,
  ]);
  expect(screen.getByText(/New accounts get 75 free credits, enough for your first/)).toBeDefined();
});

test.each([
  ["hug", "用 AI 拥抱童年的自己，两张照片就能做"],
  ["vampire", "AI 吸血鬼变身视频，一张照片就能做"],
] as const)("the %s page renders in Chinese", (kind, h1) => {
  renderWithIntl(<EffectLanding kind={kind} facts={facts} />, "zh");

  expect(screen.getByRole("heading", { level: 1, name: h1 })).toBeDefined();
});
