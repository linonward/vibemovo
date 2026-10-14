import { auth } from "./index";

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

// Takes request headers instead of reading them from Next.js, so this module
// doesn't depend on the framework.
export function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}
