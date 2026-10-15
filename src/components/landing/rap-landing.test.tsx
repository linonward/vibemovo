import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { RapLanding } from "./rap-landing";

afterEach(cleanup);

const facts = { credits: 75, signup: 10, maxImageMb: 2, maxNameLength: 30 };

test("the headline names the query and is the page's only h1", () => {
  renderWithIntl(<RapLanding facts={facts} guide="/blog/ai-rap-video-two-people" />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name: "AI rap video generator from photos" })).toBeDefined();
});

test("both calls to action sign in and return to the rap duo page", () => {
  renderWithIntl(<RapLanding facts={facts} guide="/blog/ai-rap-video-two-people" />);

  const links = screen.getAllByRole("link", { name: /Make a rap video/ });
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/en/sign-in?next=%2Fen%2Fvideos%2Frap",
    "/en/sign-in?next=%2Fen%2Fvideos%2Frap",
  ]);
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

  expect(screen.getByRole("img", { name: /Four frames from a 15-second AI rap video/ })).toBeDefined();
  expect(screen.getByText(/One video costs 75 credits/)).toBeDefined();
  expect(screen.getByText(/New accounts get 10 free credits, which is not enough/)).toBeDefined();
  expect(screen.getByRole("link", { name: "pricing page" }).getAttribute("href")).toBe("/en/pricing");
});

test("renders in Chinese", () => {
  renderWithIntl(<RapLanding facts={facts} />, "zh");

  expect(screen.getByRole("heading", { level: 1, name: "AI 说唱视频生成器，用照片就能做" })).toBeDefined();
});

const related = [{ href: "/blog/migos-ai-song-video-generator", title: "Migos AI Song & Video Generator from Two Photos" }];

test("covers ideas, photo tips and the common questions", () => {
  renderWithIntl(<RapLanding facts={facts} guide="/blog/ai-rap-video-two-people" related={related} />);

  expect(screen.getByRole("heading", { level: 2, name: "Rap videos for the people in your life" })).toBeDefined();
  expect(screen.getByRole("heading", { level: 2, name: "Photos that work" })).toBeDefined();
  const faq = screen.getByRole("region", { name: "Questions" });
  expect(within(faq).getAllByRole("term")).toHaveLength(8);
  expect(within(faq).getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/en/terms");
  expect(within(faq).getByText(/16:9 MP4, 1280×720/)).toBeDefined();
});

test("links the other effects and the locale's related guides", () => {
  renderWithIntl(<RapLanding facts={facts} related={related} />);

  const more = screen.getByRole("region", { name: "More AI video effects" });
  expect(within(more).getByRole("link", { name: /Zombie couple/ }).getAttribute("href")).toBe("/en/ai-zombie-couple-video");
  expect(within(more).getByRole("link", { name: /Migos AI Song/ }).getAttribute("href")).toBe(
    "/en/blog/migos-ai-song-video-generator",
  );
});
