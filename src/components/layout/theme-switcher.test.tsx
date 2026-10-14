import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ThemeSwitcher } from "./theme-switcher";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "dark";
  window.matchMedia = vi.fn(() => ({ matches: false }) as MediaQueryList);
});

afterEach(cleanup);

const pressed = () =>
  within(screen.getByRole("group", { name: "Theme" }))
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.getAttribute("aria-label"));

test("offers light, dark and system, with dark chosen by default", () => {
  renderWithIntl(<ThemeSwitcher />);

  expect(
    within(screen.getByRole("group", { name: "Theme" }))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual(["Light", "Dark", "System"]);
  expect(pressed()).toEqual(["Dark"]);
});

test("saves and applies the choice", () => {
  renderWithIntl(<ThemeSwitcher />);

  fireEvent.click(screen.getByRole("button", { name: "System" }));

  expect(localStorage.getItem("theme")).toBe("system");
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(pressed()).toEqual(["System"]);
});

test("is translated", () => {
  renderWithIntl(<ThemeSwitcher />, "zh");

  expect(screen.getByRole("button", { name: "跟随系统" })).toBeTruthy();
});
