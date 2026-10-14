import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { FeedbackForm } from "./feedback-form";

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function fill() {
  renderWithIntl(<FeedbackForm maxLength={2000} maxImages={3} maxImageBytes={4 * 1024 * 1024} />);
  fireEvent.change(screen.getByLabelText("Your feedback"), { target: { value: "Please add export." } });
}

test("submits feedback and clears it only after success", async () => {
  fetchMock.mockResolvedValue(Response.json({ feedback: { id: "f1" } }));
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
  expect((await screen.findByRole("status")).textContent).toBe("Your feedback has been submitted. Thank you.");
  expect(Object.fromEntries(fetchMock.mock.calls[0][1].body.entries())).toEqual({ message: "Please add export.", requestId: expect.any(String) });
  expect((screen.getByLabelText("Your feedback") as HTMLTextAreaElement).value).toBe("");
});

test("preserves text and the request ID when retrying a failed submission", async () => {
  fetchMock.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(Response.json({ feedback: { id: "f1" } }));
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
  await screen.findByRole("alert");
  expect((screen.getByLabelText("Your feedback") as HTMLTextAreaElement).value).toBe("Please add export.");
  fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
  await screen.findByRole("status");
  expect(fetchMock.mock.calls[0][1].body.get("requestId")).toBe(fetchMock.mock.calls[1][1].body.get("requestId"));
});

test("blocks blank feedback and duplicate clicks while sending", async () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  renderWithIntl(<FeedbackForm maxLength={2000} maxImages={3} maxImageBytes={4 * 1024 * 1024} />);
  const button = screen.getByRole("button", { name: "Submit feedback" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Your feedback"), { target: { value: "   " } });
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Your feedback"), { target: { value: "An idea" } });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("previews, removes and submits images without text", async () => {
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL() { return "blob:preview"; }
    static revokeObjectURL = vi.fn();
  });
  fetchMock.mockResolvedValue(Response.json({ feedback: { id: "f2" } }));
  renderWithIntl(<FeedbackForm maxLength={2000} maxImages={3} maxImageBytes={4 * 1024 * 1024} />);
  const file = new File(["png"], "screenshot.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Images"), { target: { files: [file] } });
  expect(await screen.findByAltText("screenshot.png")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove screenshot.png" }));
  expect(screen.queryByAltText("screenshot.png")).toBeNull();
  fireEvent.change(screen.getByLabelText("Images"), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
  await screen.findByRole("status");
  const body = fetchMock.mock.calls[0][1].body as FormData;
  expect(body.get("message")).toBe("");
  expect(body.getAll("images")).toEqual([file]);
  expect(screen.queryByAltText("screenshot.png")).toBeNull();
});

test("pastes images alongside selected files, keeps them on failure and retries once", async () => {
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL() { return "blob:preview"; }
    static revokeObjectURL = vi.fn();
  });
  fetchMock.mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce(Response.json({ feedback: { id: "f3" } }));
  fill();
  const selected = new File(["png"], "selected.png", { type: "image/png" });
  const pasted = new File(["png"], "pasted.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Images"), { target: { files: [selected] } });
  expect(fireEvent.paste(screen.getByLabelText("Your feedback"), { clipboardData: { files: [pasted] } })).toBe(false);
  expect(screen.getByAltText("pasted.png")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
  await screen.findByRole("alert");
  expect(screen.getByAltText("pasted.png")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
  await screen.findByRole("status");
  expect(fetchMock.mock.calls[0][1].body.getAll("images")).toEqual([selected, pasted]);
  expect(fetchMock.mock.calls[0][1].body.get("requestId")).toBe(fetchMock.mock.calls[1][1].body.get("requestId"));
});

test("leaves normal text paste to the browser", () => {
  fill();
  expect(fireEvent.paste(screen.getByLabelText("Your feedback"), { clipboardData: { files: [], getData: () => "Copied text" } })).toBe(true);
  expect(screen.queryByRole("alert")).toBeNull();
});

test.each([
  [new File(["svg"], "unsafe.svg", { type: "image/svg+xml" })],
  [new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })],
  Array.from({ length: 4 }, () => new File(["png"], "image.png", { type: "image/png" })),
])("checks pasted image format, total size and count", (...files) => {
  fill();
  fireEvent.paste(screen.getByLabelText("Your feedback"), { clipboardData: { files } });
  expect(screen.getByRole("alert").textContent).toContain("exceed the limits or use an unsupported image format");
  expect(screen.queryAllByRole("img")).toHaveLength(0);
});
