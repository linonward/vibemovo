import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const { create, remove, refresh } = vi.hoisted(() => ({
  create: vi.fn(),
  remove: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { apiKey: { create, delete: remove } } }));
vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const { ApiKeyManager } = await import("./api-key-manager");

const writeText = vi.fn(async () => {});

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const keys = [
  {
    id: "k1",
    name: "Batch script",
    start: "sk_AbCd",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    lastUsedAt: null,
    expiresAt: new Date("2026-12-30T00:00:00Z"),
  },
  {
    id: "k2",
    name: "Old one",
    start: "sk_XyZw",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    lastUsedAt: new Date("2026-02-01T00:00:00Z"),
    expiresAt: null,
  },
];

const render = (props: Partial<Parameters<typeof ApiKeyManager>[0]> = {}) =>
  renderWithIntl(<ApiKeyManager keys={keys} max={10} appUrl="https://app.example.com" {...props} />);

test("lists each key by name and first characters, never the whole key", () => {
  render();

  const table = screen.getByRole("table", { name: "Your keys" });
  const [, first, second] = within(table).getAllByRole("row");
  expect(first.textContent).toContain("Batch script");
  expect(first.textContent).toContain("sk_AbCd…");
  expect(first.textContent).toContain("Not used yet");
  expect(second.textContent).toContain("Never");
  expect(screen.getByText("2 of 10 keys")).toBeTruthy();
});

test("creates a key that expires in 90 days by default, and shows it once with a copy button", async () => {
  create.mockResolvedValue({ data: { key: "sk_the-whole-secret" }, error: null });
  render();

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nightly" } });
  fireEvent.click(screen.getByRole("button", { name: "Create key" }));

  expect(create).toHaveBeenCalledWith({ name: "Nightly", expiresIn: 90 * 24 * 3600 });
  const shown = await screen.findByRole("region", { name: "Copy your key now" });
  expect(within(shown).getByText("sk_the-whole-secret")).toBeTruthy();
  expect(refresh).toHaveBeenCalled();

  fireEvent.click(within(shown).getByRole("button", { name: "Copy" }));
  expect(writeText).toHaveBeenCalledWith("sk_the-whole-secret");
  expect(await within(shown).findByRole("button", { name: "Copied" })).toBeTruthy();

  fireEvent.click(within(shown).getByRole("button", { name: "Done" }));
  expect(screen.queryByText("sk_the-whole-secret")).toBeNull();
});

test("a key that never expires sends no expiry", async () => {
  create.mockResolvedValue({ data: { key: "sk_x" }, error: null });
  render();

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Forever" } });
  fireEvent.change(screen.getByLabelText("Expires"), { target: { value: "never" } });
  fireEvent.click(screen.getByRole("button", { name: "Create key" }));

  expect(create).toHaveBeenCalledWith({ name: "Forever", expiresIn: null });
});

test("says when the user already has the most keys allowed", async () => {
  render({ keys: Array.from({ length: 10 }, (_, n) => ({ ...keys[0], id: `k${n}` })) });

  expect(screen.getByText("You have 10 keys, the most allowed. Revoke one to create another.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Create key" }) as HTMLButtonElement).disabled).toBe(true);
});

test("reports a failed create", async () => {
  create.mockResolvedValue({ data: null, error: { code: "TOO_MANY_KEYS" } });
  render();

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Eleventh" } });
  fireEvent.click(screen.getByRole("button", { name: "Create key" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "You have 10 keys, the most allowed. Revoke one to create another.",
  );
});

test("revokes a key only after confirming", async () => {
  remove.mockResolvedValue({ data: { success: true }, error: null });
  render();

  fireEvent.click(screen.getByRole("button", { name: "Revoke Batch script" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.textContent).toContain("Scripts that use “Batch script” stop working at once.");
  expect(remove).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));

  await waitFor(() => expect(remove).toHaveBeenCalledWith({ keyId: "k1" }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});

test("shows how to call the API with this app's URL", () => {
  render();

  const docs = screen.getByRole("region", { name: "Use a key" });
  expect(docs.textContent).toContain('curl -s -X POST "https://app.example.com/api/images" -H "x-api-key: $KEY"');
});
