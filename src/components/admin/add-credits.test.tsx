import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const { AddCredits } = await import("./add-credits");

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function open() {
  renderWithIntl(<AddCredits userId="u1" email="ada@example.com" />);
  fireEvent.click(screen.getByRole("button", { name: "Add credits to ada@example.com" }));
  return screen.getByRole("alertdialog");
}

test("adds the entered amount for the user and refreshes the list", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ balance: 35 }), { status: 200 }));
  const dialog = open();
  expect(dialog.textContent).toContain("ada@example.com");

  fireEvent.change(screen.getByLabelText("Credits to add"), { target: { value: "25" } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));

  await waitFor(() => expect(refresh).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/admin/credits");
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({ userId: "u1", amount: 25 });
  expect(body.requestId).toEqual(expect.any(String));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
});

test("keeps Add disabled until the amount is a whole number from 1", () => {
  open();
  const add = screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
  expect(add.disabled).toBe(true);

  for (const value of ["0", "-3", "1.5"]) {
    fireEvent.change(screen.getByLabelText("Credits to add"), { target: { value } });
    expect(add.disabled).toBe(true);
  }
  fireEvent.change(screen.getByLabelText("Credits to add"), { target: { value: "10" } });
  expect(add.disabled).toBe(false);
});

test("shows an error and keeps the dialog open when the request fails", async () => {
  fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
  open();

  fireEvent.change(screen.getByLabelText("Credits to add"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));

  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
});

test("retries with the same request ID, so a retry never adds twice", async () => {
  fetchMock
    .mockResolvedValueOnce(new Response("{}", { status: 500 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ balance: 15 }), { status: 200 }));
  open();
  fireEvent.change(screen.getByLabelText("Credits to add"), { target: { value: "5" } });

  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());

  const ids = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).requestId);
  expect(ids[0]).toBe(ids[1]);
});
