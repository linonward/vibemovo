import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { GeneratedImage } from "@/lib/api";
import { renderWithIntl } from "@/test/intl";
import { ImageDetail } from "./image-detail";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a"> & { href: string }) => <a href={`/en${href}`} {...props} />,
}));

afterEach(cleanup);

const done: GeneratedImage = {
  id: "done",
  prompt: "An old lighthouse\non a cliff",
  aspect: "16:9",
  status: "succeeded",
  createdAt: new Date("2026-10-01T08:30:00Z"),
  url: "https://storage.test/done.png",
};

test("shows the image, its prompt and details, and downloads it in place", () => {
  renderWithIntl(<ImageDetail image={done} />);

  expect(screen.getByRole("link", { name: "All images" }).getAttribute("href")).toBe("/en/images/library");
  expect(screen.getByRole("heading", { level: 1, name: "Image details" })).toBeTruthy();
  expect(screen.getByRole("img", { name: /An old lighthouse/ }).getAttribute("src")).toBe(done.url);
  expect(screen.getByText(/on a cliff/)).toBeTruthy();
  expect(screen.getByText("16:9")).toBeTruthy();
  expect(screen.getByText("Done")).toBeTruthy();
  expect(screen.getByText("Oct 1, 2026, 8:30 AM")).toBeTruthy();
  const download = screen.getByRole("link", { name: "Download" });
  expect(download.getAttribute("href")).toBe("/api/images/done/download");
  expect(download.hasAttribute("target")).toBe(false);
});

test("the image keeps its own ratio once loaded", () => {
  renderWithIntl(<ImageDetail image={done} />);

  expect(screen.getByRole("img", { name: /An old lighthouse/ }).style.aspectRatio).toBe("auto 16 / 9");
});

test("the image opens full screen", () => {
  renderWithIntl(<ImageDetail image={done} />);

  fireEvent.click(screen.getByRole("button", { name: "View full screen" }));
  expect(screen.getByRole("dialog", { name: /An old lighthouse/ })).toBeTruthy();
});

test("explains a pending or failed image and has nothing to download", () => {
  renderWithIntl(<ImageDetail image={{ ...done, status: "pending", url: null }} />);
  expect(screen.getByText("Generating… This takes 10 to 30 seconds.")).toBeTruthy();
  expect(screen.getByText("Generating")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  expect(screen.queryByRole("button", { name: "View full screen" })).toBeNull();
  cleanup();

  renderWithIntl(<ImageDetail image={{ ...done, status: "failed", url: null }} />);
  expect(screen.getByText("Generation failed. The credit was refunded.")).toBeTruthy();
  expect(screen.getByText("Failed")).toBeTruthy();
});

test("renders in Chinese", () => {
  renderWithIntl(<ImageDetail image={done} />, "zh");

  expect(screen.getByRole("heading", { level: 1, name: "图片详情" })).toBeTruthy();
  expect(screen.getByText("已完成")).toBeTruthy();
});
