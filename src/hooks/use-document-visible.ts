import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

// False while the tab is in the background, so pollers can pause.
export function useDocumentVisible() {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === "visible",
    () => true,
  );
}
