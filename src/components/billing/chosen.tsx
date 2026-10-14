import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

// Marks the card a visitor chose on the pricing page.
export const CHOSEN = "border-primary-text ring-1 ring-primary-text";

// Focuses the chosen card's button, which scrolls it into view, or just
// scrolls to the card while buying is off.
export function useRevealChoice() {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const card = ref.current;
    const button = card?.querySelector("button");
    if (button && !button.disabled) button.focus();
    else card?.scrollIntoView({ block: "center" });
  }, []);
  return ref;
}

// The label beside the chosen card's title. It is shorter than the title's
// line, so the card keeps its height.
export function Chosen() {
  const t = useTranslations("Billing");
  return (
    <span className="mt-1 shrink-0 rounded-full bg-primary-text/12 px-2.5 py-0.5 text-xs font-semibold text-primary-text">
      {t("selected")}
    </span>
  );
}
