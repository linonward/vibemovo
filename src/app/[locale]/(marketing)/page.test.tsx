import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import Page from "./page";

afterEach(cleanup);

// The large headline is the h1: the query the home page targets, then the
// tagline. The small badge above it isn't a heading.
test("the only h1 is the large headline: the query, then the tagline", () => {
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Viral AI video templates Your photos, in a viral video.",
    }),
  ).toBeDefined();
});

test("the badge above the h1 names the brand and the templates", () => {
  renderWithIntl(<Page />);

  const badge = screen.getByText("AI video templates").parentElement;
  expect(badge?.tagName).toBe("P");
  expect(badge?.textContent).toBe("vibemovo AI video templates");
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
    screen.getByRole("heading", { level: 1, name: "AI 爆款视频模板 用你的照片，拍一条爆款视频。" }),
  ).toBeDefined();
  expect(screen.getByText("AI 视频模板")).toBeDefined();
});

// The hero plays a real template result and lists every template.
test("the hero plays a real template video and links each template", () => {
  renderWithIntl(<Page />);

  const showcase = screen.getByRole("figure", { name: "Example template video" });
  const video = within(showcase).getByLabelText(/A real 15-second AI zombie couple video/);
  expect(video.getAttribute("src")).toBe("/landing/zombie/sample.mp4");
  expect(
    within(showcase).getAllByRole("link").map((link) => link.getAttribute("href")),
  ).toEqual([
    "/en/ai-zombie-couple-video",
    "/en/ai-rap-video-generator",
    "/en/hug-your-younger-self-ai",
    "/en/ai-vampire-transformation-video",
    "/en/raindance-ai-trend",
  ]);
  expect(within(showcase).getByText("Playing")).toBeDefined();
});

// The templates are what the h1 promises; each card links its public page.
test("the templates link each template's page, right after the hero", () => {
  renderWithIntl(<Page />);

  const templates = screen.getByRole("region", { name: "Pick a template, add your photos" });
  expect(
    within(templates).getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  ).toEqual([
    "AI rap videos",
    "AI zombie couple videos",
    "AI younger-self hug videos",
    "AI vampire transformation videos",
    "Raindance AI trend videos",
  ]);
  expect(
    within(templates).getAllByRole("link").map((link) => link.getAttribute("href")),
  ).toEqual([
    "/en/ai-rap-video-generator",
    "/en/ai-zombie-couple-video",
    "/en/hug-your-younger-self-ai",
    "/en/ai-vampire-transformation-video",
    "/en/raindance-ai-trend",
  ]);
  expect(within(templates).getByText("10 seconds, 9:16 vertical")).toBeDefined();
  const sections = screen.getAllByRole("region").map((r) => r.getAttribute("aria-labelledby"));
  expect(sections.slice(0, 2)).toEqual(["templates", "ideas"]);
});

test("the hero's second link leads to the templates", () => {
  renderWithIntl(<Page />);

  expect(screen.getByRole("link", { name: "Browse templates" }).getAttribute("href")).toBe(
    "#templates",
  );
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
  expect(within(faq).getByText("06")).toBeDefined();
  expect(within(faq).getByText("What are viral AI video templates?")).toBeDefined();
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
