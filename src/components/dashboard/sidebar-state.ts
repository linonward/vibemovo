// The loading skeleton draws the sidebar collapsed when <html> has this
// attribute. SidebarProvider saves its state in the sidebar_state cookie
// (SIDEBAR_COOKIE_NAME in components/ui/sidebar.tsx); "false" is collapsed.
const ATTRIBUTE = "data-sidebar-collapsed";

// Runs from the server HTML before first paint, so a full page load shows
// the skeleton in the saved state.
export const SIDEBAR_STATE_SCRIPT = `document.documentElement.toggleAttribute("${ATTRIBUTE}",/(?:^|; )sidebar_state=false(?:;|$)/.test(document.cookie))`;

// Keeps the attribute current when the sidebar is toggled, for a layout
// that re-mounts on the client (a language switch).
export function markSidebarCollapsed(collapsed: boolean) {
  document.documentElement.toggleAttribute(ATTRIBUTE, collapsed);
}
