import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import type { GeneratedVideo } from "@/lib/api";
import { renderWithIntl } from "@/test/intl";
import { VideoLibrary } from "./video-library";

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

const videos: GeneratedVideo[] = [
  {
    id: "done",
    prompt: "The fox runs",
    duration: 5,
    resolution: "720p",
    credits: 40,
    status: "succeeded",
    createdAt: new Date("2026-10-01"),
    url: "https://storage.test/done.mp4",
    imageUrl: "https://storage.test/done.png",
  },
  {
    id: "bad",
    prompt: "Broken",
    duration: 10,
    resolution: "480p",
    credits: 40,
    status: "failed",
    createdAt: new Date("2026-10-01"),
    url: null,
    imageUrl: null,
  },
];

test("lists the page's videos and links to the pages around it", () => {
  renderWithIntl(<VideoLibrary videos={videos} page={2} pageCount={3} />);

  const list = screen.getByRole("list", { name: "All videos" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(list.querySelector("video")?.getAttribute("aria-label")).toBe("The fox runs");
  expect(within(list).getByText("Generation failed. The credits were refunded.")).toBeTruthy();

  expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/en/videos/library?page=3");
});

test("each card links to its video's page and downloads stored ones in place", () => {
  renderWithIntl(<VideoLibrary videos={videos} page={1} pageCount={1} />);

  const list = screen.getByRole("list", { name: "All videos" });
  expect(within(list).getByRole("link", { name: "The fox runs" }).getAttribute("href")).toBe("/en/videos/done");
  expect(within(list).getByRole("link", { name: "Broken" }).getAttribute("href")).toBe("/en/videos/bad");
  const downloads = within(list).getAllByRole("link", { name: "Download" });
  expect(downloads.map((link) => link.getAttribute("href"))).toEqual(["/api/videos/done/download"]);
  expect(downloads[0].hasAttribute("target")).toBe(false);
});

test("points to the generator when there are no videos", () => {
  renderWithIntl(<VideoLibrary videos={[]} page={1} pageCount={0} />);

  expect(screen.getByText("No videos yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Generate a video" }).getAttribute("href")).toBe("/en/videos");
});

test("renders in Chinese", () => {
  renderWithIntl(<VideoLibrary videos={videos} page={1} pageCount={2} />, "zh");

  expect(screen.getByRole("list", { name: "全部视频" })).toBeTruthy();
});
