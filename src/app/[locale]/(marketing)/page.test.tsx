import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import Page from "./page";

afterEach(cleanup);

test("hero headline is the page's only h1", () => {
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(
    screen.getByRole("heading", { level: 1, name: "Write a line. Watch it move." }),
  ).toBeDefined();
});

test("both calls to action lead to sign-in", () => {
  renderWithIntl(<Page />);

  const links = screen.getAllByRole("link", { name: /Start creating free/ });
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/en/sign-in",
    "/en/sign-in",
  ]);
});

test("renders in Chinese", () => {
  renderWithIntl(<Page />, "zh");

  expect(
    screen.getByRole("heading", { level: 1, name: "写一句话，看它动起来。" }),
  ).toBeDefined();
});

test("the hero preview goes from a prompt to an image to a video", () => {
  renderWithIntl(<Page />);

  const preview = screen.getByRole("figure", { name: "Example generation" });
  expect(within(preview).getByText(/A paper boat drifting/)).toBeDefined();
  expect(within(preview).getByText("Image")).toBeDefined();
  expect(within(preview).getByText("Video")).toBeDefined();
});

test("the prompt ideas name what each one makes", () => {
  renderWithIntl(<Page />);

  const ideas = screen.getByRole("region", { name: "Start from a prompt like these" });
  const items = within(ideas).getAllByRole("listitem");
  expect(items).toHaveLength(6);
  expect(within(items[0]).getByText("Video")).toBeDefined();
  expect(within(items[4]).getByText("Rap duo")).toBeDefined();
});

test("the tools link to where each one lives", () => {
  renderWithIntl(<Page />);

  const tools = screen.getByRole("region", { name: "Three ways to create" });
  expect(
    within(tools).getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  ).toEqual(["Text to image", "Image to video", "Rap duo"]);
  expect(
    within(tools).getAllByRole("link").map((link) => link.getAttribute("href")),
  ).toEqual(["/en/images", "/en/videos", "/en/ai-rap-video-generator"]);
  // Crawlers can't follow the rap duo tool behind sign-in; its public page
  // names what it is.
  expect(within(tools).getByRole("link", { name: "See the AI rap video generator" })).toBeDefined();
});

test("the steps go from a prompt to a video", () => {
  renderWithIntl(<Page />);

  const steps = screen.getByRole("region", { name: "From words to motion in three steps" });
  expect(
    within(steps).getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  ).toEqual(["Write a prompt", "Pick the best image", "Make it move"]);
});

test("FAQ questions are numbered", () => {
  renderWithIntl(<Page />);

  const faq = screen.getByRole("region", { name: "Questions" });
  expect(within(faq).getByText("01")).toBeDefined();
  expect(within(faq).getByText("05")).toBeDefined();
  expect(within(faq).getByText("How do credits work?")).toBeDefined();
});

test("the closing call to action lists three points", () => {
  renderWithIntl(<Page />);

  const cta = screen.getByRole("region", { name: "Your first scene is one prompt away." });
  expect(within(cta).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "Free credits on sign-up",
    "Images and video",
    "English and 中文",
  ]);
});
