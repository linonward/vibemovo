import { headers } from "next/headers";
import { cache } from "react";
import { getSession } from "@/server/auth/session";

// The signed-in session of the request being rendered, or null. React's
// cache shares one lookup between the layout, the page and every component
// that asks during one render. Route handlers read the session from their
// request instead (src/app/api/_lib/with-session.ts).
export const currentSession = cache(async () => getSession(await headers()));
