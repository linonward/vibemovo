import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ImageViewer } from "./image-viewer";

afterEach(cleanup);

const image = { id: "done", prompt: "An old lighthouse", url: "https://storage.test/done.png" };

function open() {
  renderWithIntl(
    <ImageViewer image={image}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={image.prompt} />
    </ImageViewer>,
  );
  fireEvent.click(screen.getByRole("button", { name: "View full screen" }));
  return screen.getByRole("dialog", { name: "An old lighthouse" });
}

test("the image opens full screen with a download link", () => {
  const dialog = open();

  expect(within(dialog).getByRole("img", { name: "An old lighthouse" }).getAttribute("src")).toBe(image.url);
  expect(within(dialog).getByRole("link", { name: "Download" }).getAttribute("href")).toBe(
    "/api/images/done/download",
  );
});

test("closes with the close button or Escape", async () => {
  fireEvent.click(within(open()).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.click(screen.getByRole("button", { name: "View full screen" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("closes when the space around the image is clicked, not the image", async () => {
  const dialog = open();

  fireEvent.click(within(dialog).getByRole("img"));
  expect(screen.getByRole("dialog")).toBeTruthy();

  fireEvent.click(screen.getByTestId("image-viewer-stage"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("renders in Chinese", () => {
  renderWithIntl(
    <ImageViewer image={image}>
      <span />
    </ImageViewer>,
    "zh",
  );

  fireEvent.click(screen.getByRole("button", { name: "全屏查看" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "关闭" })).toBeTruthy();
  expect(within(dialog).getByRole("link", { name: "下载" })).toBeTruthy();
});
