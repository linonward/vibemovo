import { beforeEach, expect, test, vi } from "vitest";
import { applyTheme, readPreference, setThemePreference } from "./theme";

let osDark = false;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "dark";
  osDark = false;
  window.matchMedia = vi.fn(() => ({ matches: osDark }) as MediaQueryList);
});

const dark = () => document.documentElement.classList.contains("dark");

test("dark is the default and the fallback for unknown values", () => {
  expect(readPreference()).toBe("dark");
  localStorage.setItem("theme", "sepia");
  expect(readPreference()).toBe("dark");
});

test("system follows the operating system", () => {
  setThemePreference("system");
  expect(localStorage.getItem("theme")).toBe("system");
  expect(dark()).toBe(false);
  expect(document.documentElement.style.colorScheme).toBe("light");

  osDark = true;
  applyTheme();
  expect(dark()).toBe(true);
});

test("light and dark ignore the operating system", () => {
  osDark = true;
  setThemePreference("light");
  expect(dark()).toBe(false);

  osDark = false;
  setThemePreference("dark");
  expect(dark()).toBe(true);
});
