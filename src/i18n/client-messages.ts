import type { AbstractIntlMessages } from "next-intl";

// The message namespaces client components read. The locale layout sends
// only these to the browser; the rest (the landing page, legal and blog
// copy, metadata) render on the server. A test fails when a client
// component reads a namespace missing here.
export const CLIENT_NAMESPACES = [
  "Admin",
  "ApiKeys",
  "Billing",
  "Chat",
  "Credits",
  "Dashboard",
  "Feedback",
  "Images",
  "LocaleSwitcher",
  "LoginForm",
  "Notifications",
  "Profile",
  "RapVideos",
  "Theme",
  "Videos",
  "ZombieVideos",
] as const;

export function clientMessages<M extends AbstractIntlMessages>(messages: M): Partial<M> {
  return Object.fromEntries(
    Object.entries(messages).filter(([namespace]) => (CLIENT_NAMESPACES as readonly string[]).includes(namespace)),
  ) as Partial<M>;
}
