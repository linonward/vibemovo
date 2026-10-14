"use client";

import { SIDEBAR_STATE_SCRIPT } from "./sidebar-state";

// Like ThemeScript: only the server renders the script, because React never
// runs a script it renders on the client. React keeps the node in <head>.
export function SidebarStateScript() {
  if (typeof window !== "undefined") return null;
  return <script dangerouslySetInnerHTML={{ __html: SIDEBAR_STATE_SCRIPT }} />;
}
