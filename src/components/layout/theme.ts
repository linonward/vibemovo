import { useSyncExternalStore } from "react";

// Theme preference, saved in localStorage. Dark is the default; "system"
// follows the operating system's light or dark setting.

export type ThemePreference = "light" | "dark" | "system";

const KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// Runs from the server HTML before first paint. Same logic as applyTheme.
export const THEME_SCRIPT = `try{var p=localStorage.getItem("${KEY}"),d=p==="system"?matchMedia("${DARK_QUERY}").matches:p!=="light",e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(e){}`;

export function readPreference(): ThemePreference {
  const value = localStorage.getItem(KEY);
  return value === "light" || value === "system" ? value : "dark";
}

export function applyTheme(preference: ThemePreference = readPreference()) {
  const dark =
    preference === "system" ? window.matchMedia(DARK_QUERY).matches : preference === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

// Re-applies on an OS switch while "system" is chosen, and on a choice made
// in another tab.
export function watchTheme() {
  const media = window.matchMedia(DARK_QUERY);
  const onMedia = () => {
    if (readPreference() === "system") applyTheme("system");
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      applyTheme();
      notify();
    }
  };
  media.addEventListener("change", onMedia);
  window.addEventListener("storage", onStorage);
  return () => {
    media.removeEventListener("change", onMedia);
    window.removeEventListener("storage", onStorage);
  };
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function setThemePreference(preference: ThemePreference) {
  localStorage.setItem(KEY, preference);
  applyTheme(preference);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The server can't see the saved choice, so it renders the default.
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "dark");
}
