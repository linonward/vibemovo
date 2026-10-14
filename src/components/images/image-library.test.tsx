import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { GeneratedImage } from "@/lib/api";
import { renderWithIntl } from "@/test/intl";
import { ImageLibrary } from "./image-library";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    ...props
  }: Omit<React.ComponentProps<"a">, "href"> & { href: string | { pathname: string; query: Record<string, string> } }) => (
    <a
      href={typeof href === "string" ? `/en${href}` : `/en${href.pathname}?${new URLSearchParams(href.query)}`}
      {...props}
    />
  ),
}));

afterEach(cleanup);

const images: GeneratedImage[] = [
  {
    id: "done",
    prompt: "An old lighthouse",
    aspect: "1:1",
    status: "succeeded",
    createdAt: new Date("2026-10-01"),
    url: "https://storage.test/done.png",
  },
  { id: "bad", prompt: "Broken", aspect: "16:9", status: "failed", createdAt: new Date("2026-10-01"), url: null },
];

test("lists the page's images and links to the pages around it", () => {
  renderWithIntl(<ImageLibrary images={images} page={2} pageCount={3} />);

  const list = screen.getByRole("list", { name: "All images" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(within(list).getByRole("img", { name: "An old lighthouse" })).toBeTruthy();
  expect(within(list).getByText("Generation failed. The credit was refunded.")).toBeTruthy();

  expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href")).toBe("/en/images/library?page=1");
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/en/images/library?page=3");
});

test("each card opens its image's page", () => {
  renderWithIntl(<ImageLibrary images={images} page={1} pageCount={1} />);

  const list = screen.getByRole("list", { name: "All images" });
  expect(within(list).getByRole("link", { name: "An old lighthouse" }).getAttribute("href")).toBe("/en/images/done");
  expect(within(list).getByRole("link", { name: "Broken" }).getAttribute("href")).toBe("/en/images/bad");
});

test("downloads only stored images, in place", () => {
  renderWithIntl(<ImageLibrary images={images} page={1} pageCount={1} />);

  const downloads = screen.getAllByRole("link", { name: "Download" });
  expect(downloads.map((link) => link.getAttribute("href"))).toEqual(["/api/images/done/download"]);
  expect(downloads[0].hasAttribute("target")).toBe(false);
});

test("a stored image opens full screen from its card", () => {
  renderWithIntl(<ImageLibrary images={images} page={1} pageCount={1} />);

  const buttons = screen.getAllByRole("button", { name: "View full screen" });
  expect(buttons).toHaveLength(1);
  fireEvent.click(buttons[0]);
  expect(screen.getByRole("dialog", { name: "An old lighthouse" })).toBeTruthy();
});

// Bailian's sizes are close to, not exactly, the aspect ratio (16:9 is
// 1696x960). A loaded image keeps its own ratio, so no strip of
// background shows beside it; a placeholder keeps the nominal one.
test("a loaded image keeps its own ratio, a placeholder the nominal one", () => {
  renderWithIntl(<ImageLibrary images={images} page={1} pageCount={1} />);

  expect(screen.getByRole("img", { name: "An old lighthouse" }).style.aspectRatio).toBe("auto 1 / 1");
  const placeholder = screen.getByText("Generation failed. The credit was refunded.");
  expect(placeholder.style.aspectRatio).toBe("16 / 9");
});

test("has no page links for a single page", () => {
  renderWithIntl(<ImageLibrary images={images} page={1} pageCount={1} />);

  expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
});

test("points to the generator when there are no images", () => {
  renderWithIntl(<ImageLibrary images={[]} page={1} pageCount={0} />);

  expect(screen.getByText("No images yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Generate an image" }).getAttribute("href")).toBe("/en/images");
});

test("renders in Chinese", () => {
  renderWithIntl(<ImageLibrary images={images} page={1} pageCount={2} />, "zh");

  expect(screen.getByRole("list", { name: "全部图片" })).toBeTruthy();
  expect(screen.getByText("第 1 页，共 2 页")).toBeTruthy();
});
