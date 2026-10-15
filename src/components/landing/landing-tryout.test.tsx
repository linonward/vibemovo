import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const useSession = vi.fn();
const push = vi.fn();
const savePhotoDraft = vi.fn();
const loadPhotoDraft = vi.fn();
const clearPhotoDraft = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession, signIn: { social: vi.fn(), magicLink: vi.fn() } },
}));
vi.mock("@/lib/photo-draft", () => ({ savePhotoDraft, loadPhotoDraft, clearPhotoDraft }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={`/en${href}`} {...props} />,
  useRouter: () => ({ push }),
}));

const { LandingTryout } = await import("./landing-tryout");

const fetchMock = vi.fn();
const signedIn = { data: { user: { id: "u1" } }, isPending: false };
const signedOut = { data: null, isPending: false };
const props = {
  kind: "hug",
  credits: 75,
  signup: 75,
  maxImageBytes: 2 * 1024 * 1024,
  imageLimits: { minSide: 240, maxSide: 8000, maxRatio: 8 },
} as const;
const reply = (status: number, body: object) => ({ ok: status < 300, status, json: async () => body });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  loadPhotoDraft.mockResolvedValue(null);
  savePhotoDraft.mockResolvedValue(undefined);
  clearPhotoDraft.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

function pick(label: string) {
  const file = new File([new Uint8Array(10)], `${label}.jpg`, { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  return file;
}

test("a signed-out visitor picks photos here, and generating asks them to sign in on this page", async () => {
  useSession.mockReturnValue(signedOut);
  window.history.replaceState(null, "", "/en/hug-your-younger-self-ai");
  renderWithIntl(<LandingTryout {...props} />);

  const today = pick("Your photo today");
  const child = pick("Your childhood photo");
  expect(screen.getByRole("img", { name: "Your childhood photo preview" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  const dialog = await screen.findByRole("dialog", { name: "Sign in to make your video" });
  expect(dialog.textContent).toContain("New accounts get 75 free credits");
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDefined();
  expect(savePhotoDraft).toHaveBeenCalledWith("landing:hug", { photos: [today, child], fields: {} });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a signed-in visitor sends the photos and goes to the tool, which shows the video", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(200, { video: { id: "v1" } }));
  renderWithIntl(<LandingTryout {...props} />);

  const today = pick("Your photo today");
  const child = pick("Your childhood photo");
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/videos/hug"));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/hug");
  expect((init.body as FormData).get("image1")).toBe(today);
  expect((init.body as FormData).get("image2")).toBe(child);
  expect(clearPhotoDraft).toHaveBeenCalledWith("landing:hug");
});

test("back from sign-in, the saved photos return and go out without another click", async () => {
  useSession.mockReturnValue(signedIn);
  const today = new File(["a"], "today.jpg", { type: "image/jpeg" });
  const child = new File(["b"], "child.jpg", { type: "image/jpeg" });
  loadPhotoDraft.mockResolvedValue({ photos: [today, child], fields: {} });
  fetchMock.mockResolvedValueOnce(reply(200, { video: { id: "v1" } }));
  window.history.replaceState(null, "", "/en/hug-your-younger-self-ai?try=1");
  renderWithIntl(<LandingTryout {...props} />);

  await waitFor(() => expect(push).toHaveBeenCalledWith("/videos/hug"));
  expect(loadPhotoDraft).toHaveBeenCalledWith("landing:hug");
  expect((fetchMock.mock.calls[0][1].body as FormData).get("image2")).toBe(child);
  expect(window.location.search).toBe("");
});

test("without enough credits, it links to pricing and keeps the photos", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(402, { error: "INSUFFICIENT_CREDITS" }));
  renderWithIntl(<LandingTryout {...props} />);

  pick("Your photo today");
  pick("Your childhood photo");
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Not enough credits");
  expect(screen.getByRole("link", { name: "Buy credits" }).getAttribute("href")).toBe("/en/pricing");
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole("img", { name: "Your photo today preview" })).toBeDefined();
});

test("the vampire transformation takes one photo", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(200, { video: { id: "v1" } }));
  renderWithIntl(<LandingTryout {...props} kind="vampire" credits={50} />);

  expect(screen.queryByLabelText("Your partner's photo")).toBeNull();
  const photo = pick("Your photo");
  fireEvent.click(screen.getByRole("button", { name: "Generate (50 credits)" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/videos/vampire"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/videos/vampire");
  expect((fetchMock.mock.calls[0][1].body as FormData).get("image1")).toBe(photo);
});

test("the raindance duo sends the one on the dock and the singer to its own route", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(200, { video: { id: "v1" } }));
  renderWithIntl(<LandingTryout {...props} kind="raindance" />);

  const dock = pick("Photo of the one on the dock");
  const singer = pick("Photo of the singer");
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/videos/raindance"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/videos/raindance");
  expect((fetchMock.mock.calls[0][1].body as FormData).get("image1")).toBe(dock);
  expect((fetchMock.mock.calls[0][1].body as FormData).get("image2")).toBe(singer);
});

test("the rap duo asks for two names too and sends them with the page's language", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(200, { video: { id: "v1" } }));
  renderWithIntl(<LandingTryout {...props} kind="rap" maxNameLength={30} />, "zh");

  const left = pick("左侧照片");
  const right = pick("右侧照片");
  const button = screen.getByRole("button", { name: "生成（75 积分）" });
  expect(button.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("左侧名字"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("右侧名字"), { target: { value: "Bo" } });
  fireEvent.click(button);

  await waitFor(() => expect(push).toHaveBeenCalledWith("/videos/rap"));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/rap");
  const form = init.body as FormData;
  expect([form.get("image1"), form.get("image2")]).toEqual([left, right]);
  expect([form.get("name1"), form.get("name2"), form.get("language")]).toEqual(["Ada", "Bo", "zh"]);
});

test("the rap duo keeps the names across sign-in", async () => {
  useSession.mockReturnValue(signedOut);
  renderWithIntl(<LandingTryout {...props} kind="rap" maxNameLength={30} />);

  const left = pick("Left photo");
  const right = pick("Right photo");
  fireEvent.change(screen.getByLabelText("Left name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Right name"), { target: { value: "Bo" } });
  fireEvent.click(screen.getByRole("button", { name: "Generate (75 credits)" }));
  await screen.findByRole("dialog");
  expect(savePhotoDraft).toHaveBeenCalledWith("landing:rap", { photos: [left, right], fields: { left: "Ada", right: "Bo" } });

  cleanup();
  useSession.mockReturnValue(signedIn);
  loadPhotoDraft.mockResolvedValue({ photos: [left, right], fields: { left: "Ada", right: "Bo" } });
  fetchMock.mockResolvedValueOnce(reply(200, { video: { id: "v1" } }));
  window.history.replaceState(null, "", "/en/ai-rap-video-generator?try=1");
  renderWithIntl(<LandingTryout {...props} kind="rap" maxNameLength={30} />);

  await waitFor(() => expect(push).toHaveBeenCalledWith("/videos/rap"));
  expect((screen.getByLabelText("Left name") as HTMLInputElement).value).toBe("Ada");
  const form = fetchMock.mock.calls[0][1].body as FormData;
  expect([form.get("name1"), form.get("name2"), form.get("language")]).toEqual(["Ada", "Bo", "en"]);
});

test("renders in Chinese", () => {
  useSession.mockReturnValue(signedOut);
  renderWithIntl(<LandingTryout {...props} kind="zombie" />, "zh");

  expect(screen.getByRole("heading", { level: 2, name: "现在就试" })).toBeDefined();
});
