import { useEffect, useRef, useState } from "react";
import { useDocumentVisible } from "./use-document-visible";

// The longest wait between rounds while the server keeps failing.
const MAX_BACKOFF_MS = 60_000;

// Asks the server about each id every `intervalMs` and hands each body to
// `onBody`; the caller drops an id from `ids` once its job has settled.
// Stops for good on 401 (the session is gone) and drops an id on 404. While
// the server fails, the wait doubles, up to a minute; a good round resets
// it. Pauses while the page is hidden. A cancelled round drops its results;
// the next round fetches them again.
export function usePendingPoll({
  ids,
  intervalMs,
  url,
  onBody,
}: {
  ids: string[];
  intervalMs: number;
  url: (id: string) => string;
  onBody: (id: string, body: unknown) => void;
}) {
  const visible = useDocumentVisible();
  const [round, setRound] = useState(0);
  const [failures, setFailures] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  const key = ids.filter((id) => !dropped.has(id)).join(",");

  // The latest callbacks, so callers needn't keep them stable.
  const latest = useRef({ url, onBody });
  useEffect(() => {
    latest.current = { url, onBody };
  });

  useEffect(() => {
    if (!key || stopped || !visible) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let failed = false;
      for (const id of key.split(",")) {
        const response = await fetch(latest.current.url(id)).catch(() => null);
        if (cancelled) return;
        if (response?.status === 401) return setStopped(true);
        if (response?.status === 404) {
          setDropped((current) => new Set(current).add(id));
          continue;
        }
        const body = response?.ok ? await response.json().catch(() => null) : null;
        if (cancelled) return;
        if (body === null) failed = true;
        else latest.current.onBody(id, body);
      }
      setFailures((current) => (failed ? current + 1 : 0));
      setRound((current) => current + 1);
    }, Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, round, failures, stopped, visible, intervalMs]);
}
