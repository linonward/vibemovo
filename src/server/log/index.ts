// Structured server logs. Each event is one line: JSON in production, so a
// log drain can search by field, and `LEVEL event key=value` in development.
// Name events `<area>.<what happened>`, e.g. "image.failed".

export type LogFields = Record<string, unknown>;

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

const WRITE: Record<Level, (line: string) => void> = {
  debug: (line) => console.debug(line),
  info: (line) => console.info(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
};

type ErrorListener = (event: string, fields: LogFields) => void;
// On globalThis: Next.js bundles instrumentation.ts apart from the routes,
// so each has its own copy of this module, and a listener added at startup
// must hear errors logged by every copy.
const LISTENERS = Symbol.for("starter.log.errorListeners");
const errorListeners: Set<ErrorListener> = ((globalThis as Record<symbol, unknown>)[LISTENERS] ??=
  new Set<ErrorListener>()) as Set<ErrorListener>;

// Calls the listener with every error event, so a tracker such as Sentry
// sees errors the code catches and logs. Returns a function that stops it.
export function onErrorLogged(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function write(level: Level, event: string, fields: LogFields = {}) {
  if (level === "error") {
    for (const listener of errorListeners) {
      try {
        listener(event, fields);
      } catch {
        // Same as a log line: never worth failing the caller for.
      }
    }
  }
  const min = LEVELS.indexOf(process.env.LOG_LEVEL as Level);
  if (LEVELS.indexOf(level) < (min === -1 ? 1 : min)) return;
  const format = process.env.LOG_FORMAT || (process.env.NODE_ENV === "production" ? "json" : "pretty");
  try {
    WRITE[level](format === "json" ? toJson(level, event, fields) : toPretty(level, event, fields));
  } catch {
    // A log line is never worth failing the caller for.
  }
}

export const log = {
  debug: (event: string, fields?: LogFields) => write("debug", event, fields),
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};

function serializeError(error: Error): LogFields {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause !== undefined && {
      cause: error.cause instanceof Error ? serializeError(error.cause) : error.cause,
    }),
  };
}

function toJson(level: Level, event: string, fields: LogFields): string {
  const seen = new WeakSet();
  // The base keys come first and win over fields of the same name.
  const base = { time: new Date().toISOString(), level, event };
  return JSON.stringify({ ...base, ...fields, ...base }, (_key, value) => {
    if (typeof value === "bigint") return String(value);
    if (value instanceof Error) return serializeError(value);
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  });
}

function toPretty(level: Level, event: string, fields: LogFields): string {
  const stacks: string[] = [];
  const pairs = Object.entries(fields).map(([key, value]) => {
    if (value instanceof Error) {
      if (value.stack) stacks.push(value.stack);
      return `${key}=${JSON.stringify(value.message)}`;
    }
    const text = typeof value === "string" ? value : toText(value);
    return `${key}=${/^[^\s"=]+$/.test(text) ? text : JSON.stringify(text)}`;
  });
  return [[level.toUpperCase().padEnd(5), event, ...pairs].join(" "), ...stacks].join("\n");
}

function toText(value: unknown): string {
  if (typeof value === "bigint" || typeof value !== "object" || value === null) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "[Unserializable]";
  }
}
