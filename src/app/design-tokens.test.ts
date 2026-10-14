// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// docs/DESIGN.md and globals.css name the same tokens, so neither drifts.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("./globals.css");
const doc = read("../../docs/DESIGN.md");

const names = (text: string, pattern: RegExp) => new Set([...text.matchAll(pattern)].map((match) => match[1]));
const declared = names(css, /(--[a-z][a-z0-9-]*)\s*:/g);
const mentioned = names(doc, /(--[a-z][a-z0-9-]*)/g);

// The theme tokens, from the :root (light) and .dark blocks.
const themed = new Set(
  [/:root\s*\{([^}]*)\}/, /\.dark\s*\{([^}]*)\}/].flatMap((block) => [
    ...names(css.match(block)?.[1] ?? "", /(--[a-z][a-z0-9-]*)\s*:/g),
  ]),
);

test("every token DESIGN.md names exists in globals.css", () => {
  expect([...mentioned].filter((name) => !declared.has(name))).toEqual([]);
});

test("DESIGN.md names every theme token", () => {
  expect(themed.size).toBeGreaterThan(0);
  expect([...themed].filter((name) => !mentioned.has(name))).toEqual([]);
});
