import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import type { GeneratedVideo } from "@/lib/api";
import { renderWithIntl } from "@/test/intl";
import { VideoDetail } from "./video-detail";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a"> & { href: string }) => <a href={`/en${href}`} {...props} />,
}));

afterEach(cleanup);

const done: GeneratedVideo = {
  id: "done",
  prompt: "The fox turns\nand runs",
  duration: 10,
  resolution: "720p",
  credits: 80,
  status: "succeeded",
  createdAt: new Date("2026-10-01T08:30:00Z"),
  url: "https://storage.test/done.mp4",
  imageUrl: "https://storage.test/done.png",
};

test("plays the video and shows its prompt and details", () => {
  renderWithIntl(<VideoDetail video={done} />);

  expect(screen.getByRole("link", { name: "All videos" }).getAttribute("href")).toBe("/en/videos/library");
  expect(screen.getByRole("heading", { level: 1, name: "Video details" })).toBeTruthy();
  const player = screen.getByLabelText(/The fox turns/);
  expect(player.tagName).toBe("VIDEO");
  expect(player.getAttribute("src")).toBe(done.url);
  expect(player.getAttribute("poster")).toBe(done.imageUrl);
  expect(player.hasAttribute("controls")).toBe(true);
  expect(screen.getByText(/and runs/)).toBeTruthy();
  expect(screen.getByText("10 s")).toBeTruthy();
  expect(screen.getByText("720p")).toBeTruthy();
  expect(screen.getByText("80 credits")).toBeTruthy();
  expect(screen.getByText("Done")).toBeTruthy();
  expect(screen.getByText("Oct 1, 2026, 8:30 AM")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Start image" }).getAttribute("src")).toBe(done.imageUrl);
});

test("downloads the video in place", () => {
  renderWithIntl(<VideoDetail video={done} />);

  const download = screen.getByRole("link", { name: "Download" });
  expect(download.getAttribute("href")).toBe("/api/videos/done/download");
  expect(download.hasAttribute("target")).toBe(false);
});

test("explains a pending or failed video and has nothing to play or download", () => {
  renderWithIntl(<VideoDetail video={{ ...done, status: "pending", url: null }} />);
  expect(screen.getByText("Generating… This takes 1 to 5 minutes.")).toBeTruthy();
  expect(screen.getByText("Generating")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  expect(document.querySelector("video")).toBeNull();
  cleanup();

  renderWithIntl(<VideoDetail video={{ ...done, status: "failed", url: null, imageUrl: null }} />);
  expect(screen.getByText("Generation failed. The credits were refunded.")).toBeTruthy();
  expect(screen.getByText("Failed")).toBeTruthy();
  expect(screen.queryByRole("img", { name: "Start image" })).toBeNull();
});

test("renders in Chinese", () => {
  renderWithIntl(<VideoDetail video={done} />, "zh");

  expect(screen.getByRole("heading", { level: 1, name: "视频详情" })).toBeTruthy();
  expect(screen.getByText("已完成")).toBeTruthy();
});
