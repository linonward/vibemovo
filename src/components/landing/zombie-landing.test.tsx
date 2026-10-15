import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ZombieLanding } from "./zombie-landing";

afterEach(cleanup);

const facts = { credits: 75, signup: 10, maxImageMb: 2 };

test("the headline names the query and is the page's only h1", () => {
  renderWithIntl(<ZombieLanding facts={facts} guide="/blog/ai-zombie-couple-video" />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name: "AI zombie couple video from two photos" })).toBeDefined();
});

test("both calls to action sign in and return to the zombie couple page", () => {
  renderWithIntl(<ZombieLanding facts={facts} />);

  const links = screen.getAllByRole("link", { name: /Make a zombie couple video/ });
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/en/sign-in?next=%2Fen%2Fvideos%2Fzombie",
    "/en/sign-in?next=%2Fen%2Fvideos%2Fzombie",
  ]);
});

test("links the guide when the locale has one", () => {
  renderWithIntl(<ZombieLanding facts={facts} guide="/blog/ai-zombie-couple-video" />);
  expect(screen.getByRole("link", { name: "Read the guide" }).getAttribute("href")).toBe(
    "/en/blog/ai-zombie-couple-video",
  );
  cleanup();

  renderWithIntl(<ZombieLanding facts={facts} />, "zh");
  expect(screen.queryByRole("link", { name: "阅读教程" })).toBeNull();
});

test("shows a real result and the real cost", () => {
  renderWithIntl(<ZombieLanding facts={facts} />);

  expect(screen.getByRole("img", { name: /Four frames from a 15-second AI zombie couple video/ })).toBeDefined();
  expect(screen.getByText(/One video costs 75 credits/)).toBeDefined();
  expect(screen.getByText(/New accounts get 10 free credits, which is not enough/)).toBeDefined();
  expect(screen.getByRole("link", { name: "pricing page" }).getAttribute("href")).toBe("/en/pricing");
});

test("renders in Chinese", () => {
  renderWithIntl(<ZombieLanding facts={facts} />, "zh");

  expect(screen.getByRole("heading", { level: 1, name: "AI 僵尸情侣视频，两张照片就能做" })).toBeDefined();
});
