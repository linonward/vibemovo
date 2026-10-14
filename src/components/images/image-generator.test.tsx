import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { CreditsProvider, useCredits } from "@/components/dashboard/credits";
import { renderWithIntl } from "@/test/intl";
import { ImageGenerator, type ImageGeneratorProps } from "./image-generator";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const props: ImageGeneratorProps = {
  balance: 5,
  cost: 1,
  aspects: ["1:1", "16:9"],
  maxPromptLength: 2000,
  enabled: true,
  images: [
    {
      id: "old",
      prompt: "An old lighthouse",
      aspect: "1:1",
      status: "succeeded",
      createdAt: new Date("2026-10-01"),
      url: "https://storage.test/old.png",
    },
    { id: "bad", prompt: "Broken", aspect: "1:1", status: "failed", createdAt: new Date("2026-10-01"), url: null },
  ],
};

const reply = (status: number, body: object) => ({ ok: status < 300, status, json: async () => body });

function submit(prompt: string) {
  fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: prompt } });
  fireEvent.click(screen.getByRole("button", { name: "Generate (1 credit)" }));
}

test("shows the balance and past images", () => {
  renderWithIntl(<ImageGenerator {...props} />);

  expect(screen.getByText("5 credits left")).toBeTruthy();
  const history = screen.getByRole("list", { name: "Your images" });
  expect(within(history).getByRole("img", { name: "An old lighthouse" })).toBeTruthy();
  expect(within(history).getByText("Generation failed. The credit was refunded.")).toBeTruthy();
});

test("links to the library for older images, but not before there are any", () => {
  renderWithIntl(<ImageGenerator {...props} />);
  expect(screen.getByRole("link", { name: "View all" }).getAttribute("href")).toBe("/en/images/library");
  cleanup();

  renderWithIntl(<ImageGenerator {...props} images={[]} />);
  expect(screen.queryByRole("link", { name: "View all" })).toBeNull();
});

const pending = {
  id: "new",
  prompt: "A red fox",
  aspect: "16:9",
  status: "pending",
  createdAt: "2026-10-12T00:00:00.000Z",
  url: null,
};

test("queues the image with the chosen aspect, then polls until it's ready", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock
    .mockResolvedValueOnce(reply(200, { image: pending }))
    .mockResolvedValueOnce(reply(200, { image: pending }))
    .mockResolvedValueOnce(
      reply(200, { image: { ...pending, status: "succeeded", url: "https://storage.test/new.png" } }),
    );
  renderWithIntl(<ImageGenerator {...props} />);

  fireEvent.click(screen.getByRole("radio", { name: "16:9" }));
  submit("A red fox");

  expect(screen.getByRole("button", { name: "Submitting…" })).toHaveProperty("disabled", true);
  await waitFor(() => expect(screen.getByText("4 credits left")).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledWith("/api/images", expect.objectContaining({ method: "POST" }));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ prompt: "A red fox", aspect: "16:9" });
  const items = within(screen.getByRole("list", { name: "Your images" })).getAllByRole("listitem");
  expect(within(items[0]).getByText("Generating… This takes 10 to 30 seconds.")).toBeTruthy();
  // The form is free for the next prompt while this one generates.
  expect(screen.getByRole("button", { name: "Generate (1 credit)" })).toBeTruthy();

  await act(() => vi.advanceTimersByTimeAsync(3000));
  await act(() => vi.advanceTimersByTimeAsync(3000));

  await waitFor(() => expect(screen.getByRole("img", { name: "A red fox" })).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledWith("/api/images/new");
  const first = within(screen.getByRole("list", { name: "Your images" })).getAllByRole("listitem")[0];
  expect(within(first).getByRole("img").getAttribute("alt")).toBe("A red fox");
});

test("adds the refund back when a pending image fails", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock.mockResolvedValueOnce(reply(200, { image: { ...pending, status: "failed" } }));
  renderWithIntl(
    <ImageGenerator {...props} balance={4} images={[{ ...pending, createdAt: new Date() } as never]} />,
  );

  await act(() => vi.advanceTimersByTimeAsync(3000));

  await waitFor(() => expect(screen.getByText("5 credits left")).toBeTruthy());
  expect(screen.getByText("Generation failed. The credit was refunded.")).toBeTruthy();
});

test("keeps the sidebar balance in step with the charge and the refund", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock
    .mockResolvedValueOnce(reply(200, { image: pending }))
    .mockResolvedValueOnce(reply(200, { image: { ...pending, status: "failed" } }));
  renderWithIntl(
    <CreditsProvider balance={5}>
      <ImageGenerator {...props} />
      <SidebarBalance />
    </CreditsProvider>,
  );

  submit("A red fox");
  await waitFor(() => expect(screen.getByLabelText("Sidebar balance").textContent).toBe("4"));

  await act(() => vi.advanceTimersByTimeAsync(3000));

  await waitFor(() => expect(screen.getByLabelText("Sidebar balance").textContent).toBe("5"));
});

// Stands in for the sidebar's account menu.
function SidebarBalance() {
  return <output aria-label="Sidebar balance">{useCredits()?.balance}</output>;
}

test.each([
  [402, "INSUFFICIENT_CREDITS", "Not enough credits. Buy more on the Credits & billing page."],
  [422, "CONTENT_BLOCKED", "The prompt or image was blocked by content moderation. Try a different prompt."],
  [502, "GENERATION_FAILED", "Generation failed. The credit was refunded. Try again."],
])("explains a %s %s reply", async (status, error, message) => {
  fetchMock.mockResolvedValueOnce(reply(status, { error }));
  renderWithIntl(<ImageGenerator {...props} />);

  submit("A red fox");

  expect((await screen.findByRole("alert")).textContent).toBe(message);
  expect(screen.getByText("5 credits left")).toBeTruthy();
});

test("is off until image generation is set up", () => {
  renderWithIntl(<ImageGenerator {...props} enabled={false} />);

  expect(screen.getByText("Image generation isn't set up yet.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Generate (1 credit)" })).toHaveProperty("disabled", true);
});

test("needs a prompt and enough credits", () => {
  renderWithIntl(<ImageGenerator {...props} balance={0} />);
  const button = screen.getByRole("button", { name: "Generate (1 credit)" });

  fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "A red fox" } });

  expect(button).toHaveProperty("disabled", true);
  expect(screen.getByRole("link", { name: "Buy credits" }).getAttribute("href")).toBe("/en/billing");
});

test("renders in Chinese", () => {
  renderWithIntl(<ImageGenerator {...props} images={[]} />, "zh");

  expect(screen.getByRole("button", { name: "生成（1 积分）" })).toBeTruthy();
  expect(screen.getByText("还没有图片。")).toBeTruthy();
});

test("fills the prompt from an example", () => {
  renderWithIntl(<ImageGenerator {...props} />);

  const example = within(screen.getByRole("group", { name: "Examples" })).getAllByRole("button")[0];
  fireEvent.click(example);

  const prompt = screen.getByLabelText("Prompt") as HTMLTextAreaElement;
  expect(prompt.value).toBe(example.getAttribute("title"));
  expect(prompt.value).not.toBe("");
});
