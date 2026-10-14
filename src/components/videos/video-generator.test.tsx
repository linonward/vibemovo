import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { CreditsProvider, useCredits } from "@/components/dashboard/credits";
import { renderWithIntl } from "@/test/intl";
import { VideoGenerator, type VideoGeneratorProps } from "./video-generator";

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

const props: VideoGeneratorProps = {
  balance: 50,
  resolutions: [
    { value: "480p", creditsPerSecond: 4 },
    { value: "720p", creditsPerSecond: 8 },
  ],
  durations: [5, 10],
  maxPromptLength: 2000,
  maxImageBytes: 4 * 1024 * 1024,
  imageLimits: { minSide: 301, maxSide: 5999, maxRatio: 2.5 },
  enabled: true,
  videos: [
    {
      id: "old",
      prompt: "An old lighthouse",
      duration: 5,
      resolution: "480p",
      credits: 20,
      status: "succeeded",
      createdAt: new Date("2026-10-01"),
      url: "https://storage.test/old.mp4",
      imageUrl: "https://storage.test/old.png",
    },
    {
      id: "bad",
      prompt: "Broken",
      duration: 5,
      resolution: "480p",
      credits: 20,
      status: "failed",
      createdAt: new Date("2026-10-01"),
      url: null,
      imageUrl: null,
    },
  ],
};

const reply = (status: number, body: object) => ({ ok: status < 300, status, json: async () => body });
const pending = {
  id: "new",
  prompt: "The fox runs",
  duration: 10,
  resolution: "720p",
  credits: 80,
  status: "pending",
  createdAt: "2026-10-12T00:00:00.000Z",
  url: null,
  imageUrl: "https://storage.test/new.png",
};

function pickImage(size = 10, type = "image/png") {
  const file = new File([new Uint8Array(size)], "fox.png", { type });
  fireEvent.change(screen.getByLabelText("Start image"), { target: { files: [file] } });
  return file;
}

function submit(prompt: string, button = "Generate (20 credits)") {
  fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: prompt } });
  fireEvent.click(screen.getByRole("button", { name: button }));
}

test("shows the balance and past videos", () => {
  renderWithIntl(<VideoGenerator {...props} />);

  expect(screen.getByText("50 credits left")).toBeTruthy();
  const history = screen.getByRole("list", { name: "Your videos" });
  expect(within(history).getByLabelText("An old lighthouse").tagName).toBe("VIDEO");
  expect(within(history).getByText("Generation failed. The credits were refunded.")).toBeTruthy();
});

test("links to the library, but not before there are any videos", () => {
  renderWithIntl(<VideoGenerator {...props} />);
  expect(screen.getByRole("link", { name: "View all" }).getAttribute("href")).toBe("/en/videos/library");
  cleanup();

  renderWithIntl(<VideoGenerator {...props} videos={[]} />);
  expect(screen.queryByRole("link", { name: "View all" })).toBeNull();
});

test("uploads the image with the chosen length and resolution, then polls until the video is ready", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock
    .mockResolvedValueOnce(reply(200, { video: pending }))
    .mockResolvedValueOnce(reply(200, { video: pending }))
    .mockResolvedValueOnce(
      reply(200, { video: { ...pending, status: "succeeded", url: "https://storage.test/new.mp4" } }),
    );
  renderWithIntl(<VideoGenerator {...props} balance={100} />);

  const file = pickImage();
  expect(screen.getByRole("img", { name: "Start image preview" }).getAttribute("src")).toBe("blob:preview");
  fireEvent.click(screen.getByRole("radio", { name: "10 s" }));
  expect(screen.getByRole("button", { name: "Generate (40 credits)" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "720p" }));
  submit("The fox runs", "Generate (80 credits)");

  await waitFor(() => expect(screen.getByText("20 credits left")).toBeTruthy());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos");
  expect(init.method).toBe("POST");
  const body = init.body as FormData;
  expect(body.get("prompt")).toBe("The fox runs");
  expect(body.get("duration")).toBe("10");
  expect(body.get("resolution")).toBe("720p");
  expect(body.get("image")).toBe(file);
  const items = within(screen.getByRole("list", { name: "Your videos" })).getAllByRole("listitem");
  expect(within(items[0]).getByText("Generating… This takes 1 to 5 minutes.")).toBeTruthy();
  expect(within(items[0]).getByText(/10 s · 720p/)).toBeTruthy();

  await act(() => vi.advanceTimersByTimeAsync(5000));
  await act(() => vi.advanceTimersByTimeAsync(5000));

  await waitFor(() => expect(screen.getByLabelText("The fox runs").tagName).toBe("VIDEO"));
  expect(fetchMock).toHaveBeenCalledWith("/api/videos/new");
});

test("adds the refund back when a pending video fails", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock.mockResolvedValueOnce(reply(200, { video: { ...pending, status: "failed" } }));
  renderWithIntl(<VideoGenerator {...props} balance={10} videos={[{ ...pending, createdAt: new Date() } as never]} />);

  await act(() => vi.advanceTimersByTimeAsync(5000));

  await waitFor(() => expect(screen.getByText("90 credits left")).toBeTruthy());
  expect(screen.getByText("Generation failed. The credits were refunded.")).toBeTruthy();
});

test("keeps the sidebar balance in step with the charge and the refund", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock
    .mockResolvedValueOnce(reply(200, { video: { ...pending, credits: 20 } }))
    .mockResolvedValueOnce(reply(200, { video: { ...pending, credits: 20, status: "failed" } }));
  renderWithIntl(
    <CreditsProvider balance={50}>
      <VideoGenerator {...props} />
      <SidebarBalance />
    </CreditsProvider>,
  );

  pickImage();
  submit("The fox runs");
  await waitFor(() => expect(screen.getByLabelText("Sidebar balance").textContent).toBe("30"));

  await act(() => vi.advanceTimersByTimeAsync(5000));

  await waitFor(() => expect(screen.getByLabelText("Sidebar balance").textContent).toBe("50"));
});

// Stands in for the sidebar's account menu.
function SidebarBalance() {
  return <output aria-label="Sidebar balance">{useCredits()?.balance}</output>;
}

test.each([
  [402, "INSUFFICIENT_CREDITS", "Not enough credits. Buy more on the Credits & billing page."],
  [400, "INVALID_REQUEST", "Use a JPEG, PNG or WebP image up to 4 MB."],
  [422, "CONTENT_BLOCKED", "The prompt or start image was blocked by content moderation. Try a different one."],
  [503, "MODERATION_UNAVAILABLE", "The prompt or start image couldn't be approved right now. No credits were spent. Try again later."],
  [400, "INVALID_IMAGE_SIZE", "Use an image 301 to 5,999 pixels on each side, with the long side at most 2.5 times the short side."],
  [502, "GENERATION_FAILED", "Generation failed. The credits were refunded. Try again."],
])("explains a %s %s reply", async (status, error, message) => {
  fetchMock.mockResolvedValueOnce(reply(status, { error }));
  renderWithIntl(<VideoGenerator {...props} />);

  pickImage();
  submit("The fox runs");

  expect((await screen.findByRole("alert")).textContent).toBe(message);
  expect(screen.getByText("50 credits left")).toBeTruthy();
});

test("refuses an image over the size limit before uploading", () => {
  renderWithIntl(<VideoGenerator {...props} />);

  pickImage(4 * 1024 * 1024 + 1);

  expect(screen.getByRole("alert").textContent).toBe("Use a JPEG, PNG or WebP image up to 4 MB.");
  fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "The fox runs" } });
  expect(screen.getByRole("button", { name: "Generate (20 credits)" })).toHaveProperty("disabled", true);
});

test("needs an image, a prompt and enough credits", () => {
  renderWithIntl(<VideoGenerator {...props} balance={19} />);
  const button = screen.getByRole("button", { name: "Generate (20 credits)" });

  fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "The fox runs" } });
  pickImage();

  expect(button).toHaveProperty("disabled", true);
  expect(screen.getByRole("link", { name: "Buy credits" }).getAttribute("href")).toBe("/en/billing");
});

test("hides the resolution choice when the provider has one", () => {
  renderWithIntl(<VideoGenerator {...props} resolutions={[{ value: "1080p", creditsPerSecond: 4 }]} />);

  expect(screen.queryByRole("group", { name: "Resolution" })).toBeNull();
  expect(screen.getByRole("button", { name: "Generate (20 credits)" })).toBeTruthy();
});

test("is off until video generation is set up", () => {
  renderWithIntl(<VideoGenerator {...props} enabled={false} />);

  expect(screen.getByText("Video generation isn't set up yet.")).toBeTruthy();
});

test("renders in Chinese", () => {
  renderWithIntl(<VideoGenerator {...props} videos={[]} />, "zh");

  expect(screen.getByRole("button", { name: "生成（20 积分）" })).toBeTruthy();
  expect(screen.getByText("还没有视频。")).toBeTruthy();
});

test("fills the prompt from an example", () => {
  renderWithIntl(<VideoGenerator {...props} />);

  const example = within(screen.getByRole("group", { name: "Examples" })).getAllByRole("button")[0];
  fireEvent.click(example);

  const prompt = screen.getByLabelText("Prompt") as HTMLTextAreaElement;
  expect(prompt.value).toBe(example.getAttribute("title"));
  expect(prompt.value).not.toBe("");
});

// The browser reads the photo's size, so one the provider would refuse never uploads.
test("turns away an image outside the provider's limits as soon as it is picked", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 194, height: 259, close: vi.fn() })));
  renderWithIntl(<VideoGenerator {...props} />);

  pickImage();

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Use an image 301 to 5,999 pixels on each side, with the long side at most 2.5 times the short side.",
  );
  submit("The fox runs");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("keeps an image within the limits", async () => {
  const read = vi.fn(async () => ({ width: 1280, height: 720, close: vi.fn() }));
  vi.stubGlobal("createImageBitmap", read);
  fetchMock.mockResolvedValueOnce(reply(200, { video: pending }));
  renderWithIntl(<VideoGenerator {...props} />);

  pickImage();
  await waitFor(() => expect(read).toHaveBeenCalled());
  submit("The fox runs");

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("alert")).toBeNull();
});
