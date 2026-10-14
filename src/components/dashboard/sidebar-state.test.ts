import { afterEach, expect, test } from "vitest";
import { SIDEBAR_STATE_SCRIPT } from "./sidebar-state";

const html = document.documentElement;
const run = () => new Function(SIDEBAR_STATE_SCRIPT)();
const setCookie = (value: string) => {
  document.cookie = `sidebar_state=${value}; path=/`;
};

afterEach(() => {
  document.cookie = "sidebar_state=; path=/; max-age=0";
  html.removeAttribute("data-sidebar-collapsed");
});

test("marks <html> when the saved sidebar is collapsed", () => {
  setCookie("false");
  run();
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(true);
});

test("leaves <html> unmarked when the sidebar is open or never saved", () => {
  setCookie("true");
  run();
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);

  document.cookie = "sidebar_state=; path=/; max-age=0";
  html.setAttribute("data-sidebar-collapsed", "");
  run();
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);
});
