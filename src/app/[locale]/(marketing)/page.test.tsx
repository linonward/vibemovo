import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import Page from "./page";

afterEach(cleanup);

test("hero headline is the page's only h1", () => {
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Everything before your first feature, done.",
    }),
  ).toBeDefined();
});

test("both calls to action lead to sign-in", () => {
  renderWithIntl(<Page />);

  const links = screen.getAllByRole("link", { name: /Create your account/ });
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/en/sign-in",
    "/en/sign-in",
  ]);
});

test("renders in Chinese", () => {
  renderWithIntl(<Page />, "zh");

  expect(
    screen.getByRole("heading", { level: 1, name: "第一个功能之前的事，都做好了。" }),
  ).toBeDefined();
});

test("the closing call to action lists three points", () => {
  renderWithIntl(<Page />);

  const cta = screen.getByRole("region", { name: "Ready when you are." });
  expect(within(cta).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "Magic-link sign-in",
    "Credits and payments",
    "English and 中文",
  ]);
});

test("the features list what the template ships", () => {
  renderWithIntl(<Page />);

  const features = screen.getByRole("region", { name: "What's already built" });
  expect(
    within(features).getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  ).toEqual([
    "Sign in without passwords",
    "Credits and payments",
    "AI chat, images and video",
    "Notifications and admin",
    "English and 中文",
    "Accounts and legal pages",
  ]);
});

test("the steps go from sign-in to creating", () => {
  renderWithIntl(<Page />);

  const steps = screen.getByRole("region", { name: "How it works" });
  expect(
    within(steps).getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  ).toEqual(["Sign in", "Get free credits", "Create"]);
});

test("FAQ questions are numbered", () => {
  renderWithIntl(<Page />);

  const faq = screen.getByRole("region", { name: "Questions" });
  expect(within(faq).getByText("01")).toBeDefined();
  expect(within(faq).getByText("05")).toBeDefined();
  expect(within(faq).getByText("How do credits work?")).toBeDefined();
});
