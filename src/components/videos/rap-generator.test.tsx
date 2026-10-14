import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { RapGenerator, type RapGeneratorProps } from "./rap-generator";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
});

const props: RapGeneratorProps = {
  balance: 100,
  credits: 75,
  maxImageBytes: 2 * 1024 * 1024,
  maxNameLength: 30,
  imageLimits: { minSide: 240, maxSide: 8000, maxRatio: 8 },
  enabled: true,
  videos: [],
};

const reply = (status: number, body: object) => ({ ok: status < 300, status, json: async () => body });
const pending = {
  id: "new",
  prompt: "Ada & Bo: Ada raps / Bo raps",
  duration: 15,
  resolution: "720p",
  credits: 75,
  status: "pending",
  createdAt: "2026-10-13T00:00:00.000Z",
  url: null,
  imageUrl: "https://storage.test/new.jpg",
};

function pick(label: string, size = 10) {
  const file = new File([new Uint8Array(size)], `${label}.jpg`, { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  return file;
}

function fill() {
  const left = pick("Left photo");
  const right = pick("Right photo");
  fireEvent.change(screen.getByLabelText("Left name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Right name"), { target: { value: "Bo" } });
  return { left, right };
}

test("needs both photos and both names before it generates", () => {
  renderWithIntl(<RapGenerator {...props} />);
  const button = screen.getByRole("button", { name: "Generate (75 credits)" });

  expect(button.hasAttribute("disabled")).toBe(true);
  pick("Left photo");
  fireEvent.change(screen.getByLabelText("Left name"), { target: { value: "Ada" } });
  expect(button.hasAttribute("disabled")).toBe(true);
  fill();
  expect(button.hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("img", { name: "Left photo preview" }).getAttribute("src")).toBe("blob:preview");
});

test("sends the photos, names and page language, then polls until the video is ready", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock
    .mockResolvedValueOnce(reply(200, { video: pending }))
    .mockResolvedValueOnce(
      reply(200, { video: { ...pending, status: "succeeded", url: "https://storage.test/new.mp4" } }),
    );
  renderWithIntl(<RapGenerator {...props} />);

  const { left, right } = fill();
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  await waitFor(() => expect(screen.getByText("25 credits left")).toBeTruthy());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/rap");
  const form = init.body as FormData;
  expect(form.get("image1")).toBe(left);
  expect(form.get("image2")).toBe(right);
  expect(form.get("name1")).toBe("Ada");
  expect(form.get("name2")).toBe("Bo");
  expect(form.get("language")).toBe("en");

  await vi.advanceTimersByTimeAsync(5000);
  const history = screen.getByRole("list", { name: "Your videos" });
  await waitFor(() => expect(within(history).getByLabelText(pending.prompt).tagName).toBe("VIDEO"));
  expect(fetchMock.mock.calls[1][0]).toBe("/api/videos/new");
});

test("refuses a photo over the size limit", () => {
  renderWithIntl(<RapGenerator {...props} />);

  pick("Right photo", 2 * 1024 * 1024 + 1);

  expect(screen.getByRole("alert").textContent).toContain("2 MB");
  expect(screen.queryByRole("img", { name: "Right photo preview" })).toBeNull();
});

test.each([
  [402, "INSUFFICIENT_CREDITS", "Not enough credits"],
  [422, "CONTENT_BLOCKED", "blocked by content moderation"],
  [503, "MODERATION_UNAVAILABLE", "couldn't be checked right now"],
  [400, "INVALID_IMAGE_SIZE", "Use photos 240 to 8,000 pixels on each side"],
  [503, "VIDEOS_DISABLED", "isn't set up yet"],
])("explains a %s reply", async (status, error, text) => {
  fetchMock.mockResolvedValueOnce(reply(status, { error }));
  renderWithIntl(<RapGenerator {...props} />);

  fill();
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(text));
  expect(screen.getByText("100 credits left")).toBeTruthy();
});

test("links to billing when the balance is short, and says when it is off", () => {
  renderWithIntl(<RapGenerator {...props} balance={10} enabled={false} />);

  expect(screen.getByText("The rap duo isn't set up yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Buy credits" }).getAttribute("href")).toBe("/en/billing");
  cleanup();
});

test("turns away a photo Bailian would refuse as soon as it is picked", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 194, height: 259, close: vi.fn() })));
  renderWithIntl(<RapGenerator {...props} />);

  fill();

  expect((await screen.findByRole("alert")).textContent).toContain("Use photos 240 to 8,000 pixels on each side");
  expect((screen.getByRole("button", { name: "Generate (75 credits)" }) as HTMLButtonElement).disabled).toBe(true);
});
