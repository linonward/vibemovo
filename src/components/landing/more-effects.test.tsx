import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { MoreEffects } from "./more-effects";

afterEach(cleanup);

test.each([
  ["rap", ["/en/ai-zombie-couple-video", "/en/hug-your-younger-self-ai", "/en/ai-vampire-transformation-video"]],
  ["zombie", ["/en/ai-rap-video-generator", "/en/hug-your-younger-self-ai", "/en/ai-vampire-transformation-video"]],
  ["hug", ["/en/ai-rap-video-generator", "/en/ai-zombie-couple-video", "/en/ai-vampire-transformation-video"]],
  ["vampire", ["/en/ai-rap-video-generator", "/en/ai-zombie-couple-video", "/en/hug-your-younger-self-ai"]],
] as const)("the %s page links every other effect's landing page", (current, hrefs) => {
  renderWithIntl(<MoreEffects current={current} />);

  const more = screen.getByRole("region", { name: "More AI video effects" });
  expect(within(more).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(hrefs);
});

test("names each effect and lists the related guides after them", () => {
  renderWithIntl(<MoreEffects current="zombie" related={[{ href: "/blog/some-guide", title: "Some guide" }]} />);

  const more = screen.getByRole("region", { name: "More AI video effects" });
  expect(within(more).getByRole("link", { name: /Rap duo/ })).toBeDefined();
  expect(within(more).getByRole("link", { name: /Younger-self hug/ })).toBeDefined();
  expect(within(more).getByRole("link", { name: /Vampire transformation/ })).toBeDefined();
  expect(within(more).getAllByRole("link").at(-1)?.getAttribute("href")).toBe("/en/blog/some-guide");
});

test("renders in Chinese", () => {
  renderWithIntl(<MoreEffects current="rap" />, "zh");

  const more = screen.getByRole("region", { name: "更多 AI 视频特效" });
  expect(within(more).getByRole("link", { name: /僵尸情侣/ })).toBeDefined();
  expect(within(more).getByRole("link", { name: /拥抱童年的自己/ })).toBeDefined();
  expect(within(more).getByRole("link", { name: /吸血鬼变身/ })).toBeDefined();
});
