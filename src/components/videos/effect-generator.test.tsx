import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { EffectGenerator, type EffectGeneratorProps } from "./effect-generator";

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

const props: EffectGeneratorProps = {
  kind: "zombie",
  balance: 100,
  credits: 75,
  maxImageBytes: 2 * 1024 * 1024,
  imageLimits: { minSide: 240, maxSide: 8000, maxRatio: 8 },
  enabled: true,
  videos: [],
};

const reply = (status: number, body: object) => ({ ok: status < 300, status, json: async () => body });
const pending = {
  id: "new",
  prompt: "Zombie couple",
  duration: 15,
  resolution: "720p",
  credits: 75,
  status: "pending",
  createdAt: "2026-10-15T00:00:00.000Z",
  url: null,
  imageUrl: "https://storage.test/new.jpg",
};

function pick(label: string, size = 10) {
  const file = new File([new Uint8Array(size)], `${label}.jpg`, { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  return file;
}

test("needs both photos before it generates", () => {
  renderWithIntl(<EffectGenerator {...props} />);
  const button = screen.getByRole("button", { name: "Generate (75 credits)" });

  pick("Your photo");
  expect(button.hasAttribute("disabled")).toBe(true);
  pick("Your partner's photo");
  expect(button.hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("img", { name: "Your partner's photo preview" }).getAttribute("src")).toBe("blob:preview");
});

test("sends both photos, then polls until the video is ready", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock
    .mockResolvedValueOnce(reply(200, { video: pending }))
    .mockResolvedValueOnce(
      reply(200, { video: { ...pending, status: "succeeded", url: "https://storage.test/new.mp4" } }),
    );
  renderWithIntl(<EffectGenerator {...props} />);

  const left = pick("Your photo");
  const right = pick("Your partner's photo");
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  await waitFor(() => expect(screen.getByText("25 credits left")).toBeTruthy());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/zombie");
  const form = init.body as FormData;
  expect(form.get("image1")).toBe(left);
  expect(form.get("image2")).toBe(right);

  await vi.advanceTimersByTimeAsync(5000);
  const history = screen.getByRole("list", { name: "Your videos" });
  await waitFor(() => expect(within(history).getByLabelText(pending.prompt).tagName).toBe("VIDEO"));
});

test("the younger-self hug asks for today's and a childhood photo and sends them to its own route", async () => {
  fetchMock.mockResolvedValueOnce(reply(200, { video: { ...pending, prompt: "Hug your younger self" } }));
  renderWithIntl(<EffectGenerator {...props} kind="hug" />);

  expect(screen.getByRole("heading", { level: 2, name: "Your videos" })).toBeTruthy();
  const today = pick("Your photo today");
  const child = pick("Your childhood photo");
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  await waitFor(() => expect(screen.getByText("25 credits left")).toBeTruthy());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/hug");
  expect((init.body as FormData).get("image1")).toBe(today);
  expect((init.body as FormData).get("image2")).toBe(child);
});

test("the raindance duo asks for the one on the dock and the singer and sends them to its own route", async () => {
  fetchMock.mockResolvedValueOnce(reply(200, { video: { ...pending, prompt: "Raindance duo" } }));
  renderWithIntl(<EffectGenerator {...props} kind="raindance" />);

  const dock = pick("Photo of the one on the dock");
  const singer = pick("Photo of the singer");
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  await waitFor(() => expect(screen.getByText("25 credits left")).toBeTruthy());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/raindance");
  expect((init.body as FormData).get("image1")).toBe(dock);
  expect((init.body as FormData).get("image2")).toBe(singer);
});

test("the vampire transformation asks for one photo and sends it as image1", async () => {
  fetchMock.mockResolvedValueOnce(reply(200, { video: { ...pending, prompt: "Vampire transformation", credits: 50 } }));
  renderWithIntl(<EffectGenerator {...props} kind="vampire" credits={50} />);

  expect(screen.queryByLabelText("Your partner's photo")).toBeNull();
  const photo = pick("Your photo");
  fireEvent.click(screen.getByRole("button", { name: "Generate (50 credits)" }));

  await waitFor(() => expect(screen.getByText("50 credits left")).toBeTruthy());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/vampire");
  const form = init.body as FormData;
  expect(form.get("image1")).toBe(photo);
  expect(form.has("image2")).toBe(false);
});

test("object effects let the user pick an effect and send it with the photo", async () => {
  fetchMock.mockResolvedValueOnce(reply(200, { video: { ...pending, prompt: "Cake", duration: 5, credits: 25 } }));
  renderWithIntl(<EffectGenerator {...props} kind="object" credits={25} effects={["squish", "inflate", "cake"]} />);

  expect((screen.getByRole("radio", { name: "Squish" }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "It's a cake" }));
  const photo = pick("Your photo");
  fireEvent.click(screen.getByRole("button", { name: "Generate (25 credits)" }));

  await waitFor(() => expect(screen.getByText("75 credits left")).toBeTruthy());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/effects");
  const form = init.body as FormData;
  expect(form.get("image1")).toBe(photo);
  expect(form.get("effect")).toBe("cake");
});

test("refuses a photo over the size limit", () => {
  renderWithIntl(<EffectGenerator {...props} />);

  pick("Your photo", 2 * 1024 * 1024 + 1);

  expect(screen.getByRole("alert").textContent).toContain("2 MB");
  expect(screen.queryByRole("img", { name: "Your photo preview" })).toBeNull();
});

test.each([
  [402, "INSUFFICIENT_CREDITS", "Not enough credits"],
  [422, "CONTENT_BLOCKED", "blocked by content moderation"],
  [400, "INVALID_IMAGE_SIZE", "Use photos 240 to 8,000 pixels on each side"],
  [503, "VIDEOS_DISABLED", "isn't set up yet"],
])("explains a %s reply", async (status, error, text) => {
  fetchMock.mockResolvedValueOnce(reply(status, { error }));
  renderWithIntl(<EffectGenerator {...props} />);

  pick("Your photo");
  pick("Your partner's photo");
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(text));
  expect(screen.getByText("100 credits left")).toBeTruthy();
});

test.each([
  ["zombie", ["Your photo", "Your partner's photo"], "A photo was blocked by content moderation. Try a different one."],
  ["vampire", ["Your photo"], "The photo was blocked by content moderation. Try a different one."],
] as const)("a %s's shared errors speak of its number of photos", async (kind, labels, text) => {
  fetchMock.mockResolvedValueOnce(reply(422, { error: "CONTENT_BLOCKED" }));
  renderWithIntl(<EffectGenerator {...props} kind={kind} />);

  labels.forEach((label) => pick(label));
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(text));
});

test("links to billing when the balance is short, and says when it is off", () => {
  renderWithIntl(<EffectGenerator {...props} balance={10} enabled={false} />);

  expect(screen.getByText("The zombie couple isn't set up yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Buy credits" }).getAttribute("href")).toBe("/en/billing");
});
