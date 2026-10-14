// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

// The runbook's variable table lists exactly the variables the app reads,
// so neither the docs nor .env.example drift from the code.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

// Set by Node.js or Next.js, not by the operator.
const RUNTIME = new Set(["NODE_ENV", "NEXT_RUNTIME"]);

const section = read("docs/runbook.md").split(/^## /m).find((part) => part.startsWith("Environment variables\n")) ?? "";
const documented = new Set([...section.matchAll(/^\| `([A-Z][A-Z0-9_]*)`/gm)].map((match) => match[1]));

const example = [...read(".env.example").matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);

const source = readdirSync(new URL("src/", root), { recursive: true, encoding: "utf8" })
  .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
  .map((path) => read(`src/${path}`))
  .join("\n");
const inCode = [...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]);

const used = new Set([...example, ...inCode].filter((name) => !RUNTIME.has(name)));

test("the runbook documents every variable in .env.example and the code", () => {
  expect(documented.size).toBeGreaterThan(0);
  expect([...used].filter((name) => !documented.has(name)).sort()).toEqual([]);
});

test("the runbook documents no variable the app doesn't read", () => {
  expect([...documented].filter((name) => !used.has(name)).sort()).toEqual([]);
});
