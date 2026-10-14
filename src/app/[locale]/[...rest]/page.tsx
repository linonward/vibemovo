import { notFound } from "next/navigation";

// Sends unknown paths under a locale to [locale]/not-found.tsx.
export default function CatchAll() {
  notFound();
}
