import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const social = vi.fn();
const magicLink = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social, magicLink } },
}));
// Stands in for the Cloudflare widget: a button that hands over a token.
vi.mock("./turnstile", () => ({
  Turnstile: ({ onToken }: { onToken: (token: string | null) => void }) => (
    <button type="button" onClick={() => onToken("turnstile-token")}>
      Solve challenge
    </button>
  ),
}));

const { LoginForm } = await import("./login-form");

afterEach(() => {
  cleanup();
  social.mockReset();
  magicLink.mockReset();
});

function sendMagicLink() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
}

test("starts Google sign-in and returns to the dashboard", async () => {
  social.mockResolvedValue({ data: { redirect: true }, error: null });
  renderWithIntl(<LoginForm />);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

  expect(social).toHaveBeenCalledWith({ provider: "google", callbackURL: "/en/dashboard" });
});

test("explains when Google sign-in isn't configured", async () => {
  social.mockResolvedValue({
    data: null,
    error: { status: 404, code: "PROVIDER_NOT_FOUND" },
  });
  renderWithIntl(<LoginForm />);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Google sign-in isn't available. Use a magic link instead.",
  );
});

test.each([
  ["/en/billing", "/en/billing"],
  ["/en/images?page=2", "/en/images?page=2"],
  // Anything that could leave the site falls back to the dashboard.
  ["//evil.example", "/en/dashboard"],
  ["https://evil.example", "/en/dashboard"],
  ["/\\evil.example", "/en/dashboard"],
  ["/\t/evil.example", "/en/dashboard"],
  ["", "/en/dashboard"],
])("with ?next=%j, signs in and returns to %s", async (next, callbackURL) => {
  window.history.replaceState(null, "", `/en/sign-in?next=${encodeURIComponent(next)}`);
  social.mockResolvedValue({ data: { redirect: true }, error: null });
  renderWithIntl(<LoginForm />);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

  expect(social).toHaveBeenCalledWith({ provider: "google", callbackURL });
  window.history.replaceState(null, "", "/");
});

test("without Turnstile, sends the magic link with no challenge", async () => {
  magicLink.mockResolvedValue({ data: { status: true }, error: null });
  renderWithIntl(<LoginForm />);

  expect(screen.queryByRole("button", { name: "Solve challenge" })).toBeNull();
  sendMagicLink();

  await screen.findByRole("status");
  expect(magicLink).toHaveBeenCalledWith({
    email: "ada@example.com",
    callbackURL: "/en/dashboard",
    fetchOptions: { headers: {} },
  });
});

test("with Turnstile, waits for the challenge and sends its token", async () => {
  magicLink.mockResolvedValue({ data: { status: true }, error: null });
  renderWithIntl(<LoginForm turnstileSiteKey="site-key" />);

  const send = screen.getByRole("button", { name: "Send magic link" });
  expect(send).toHaveProperty("disabled", true);

  fireEvent.click(screen.getByRole("button", { name: "Solve challenge" }));
  expect(send).toHaveProperty("disabled", false);
  sendMagicLink();

  await screen.findByRole("status");
  expect(magicLink).toHaveBeenCalledWith({
    email: "ada@example.com",
    callbackURL: "/en/dashboard",
    fetchOptions: { headers: { "x-captcha-response": "turnstile-token" } },
  });
});

test("a token is used once: after a failed send, the challenge runs again", async () => {
  magicLink.mockResolvedValue({ data: null, error: { status: 400 } });
  renderWithIntl(<LoginForm turnstileSiteKey="site-key" />);

  fireEvent.click(screen.getByRole("button", { name: "Solve challenge" }));
  sendMagicLink();

  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Send magic link" })).toHaveProperty("disabled", true);
});
