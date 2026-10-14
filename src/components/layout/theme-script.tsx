"use client";

import { useEffect, useLayoutEffect } from "react";
import { applyTheme, THEME_SCRIPT, watchTheme } from "./theme";

// The saved theme is applied:
// - by the inline script in the server HTML, before first paint;
// - after React mounts <html>, which resets its class to the server's. A
//   language switch re-mounts the root layout on the client;
// - when the OS switches while "system" is chosen.
export function ThemeScript() {
  useLayoutEffect(() => applyTheme(), []);
  useEffect(watchTheme, []);

  // React never runs a script it renders on the client (and warns), so only
  // the server renders it. React keeps the extra node in <head> on hydration.
  if (typeof window !== "undefined") return null;
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
