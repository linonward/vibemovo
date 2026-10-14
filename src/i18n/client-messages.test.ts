// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { expect, test } from "vitest";
import en from "../../messages/en.json";
import { CLIENT_NAMESPACES, clientMessages } from "./client-messages";

// Every module that runs in the browser: "use client" files and everything
// they import from src/.
function clientModules(): Map<string, string> {
  const files = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
  const source = new Map(files.filter((file) => existsSync(file)).map((file) => [file, readFileSync(file, "utf8")]));
  const resolve = (spec: string, from: string) => {
    const base = spec.startsWith("@/") ? join("src", spec.slice(2)) : spec.startsWith(".") ? normalize(join(dirname(from), spec)) : null;
    if (!base) return null;
    return [".tsx", ".ts", "/index.tsx", "/index.ts"].map((ext) => base + ext).find((file) => source.has(file)) ?? null;
  };

  const client = new Map([...source].filter(([, code]) => /^\s*["']use client["']/.test(code)));
  const queue = [...client.keys()];
  for (let file = queue.pop(); file; file = queue.pop()) {
    for (const [, spec] of client.get(file)!.matchAll(/(?:from\s+|import\(\s*)"([^"]+)"/g)) {
      const found = resolve(spec, file);
      if (found && !client.has(found)) {
        client.set(found, source.get(found)!);
        queue.push(found);
      }
    }
  }
  return client;
}

test("the browser gets every namespace a client component reads", () => {
  const used = new Set<string>();
  for (const [file, code] of clientModules()) {
    for (const [, args] of code.matchAll(/useTranslations\(([^)]*)\)/g)) {
      const literal = /^\s*"(\w+)/.exec(args);
      // A namespace this test can't read is one it can't check.
      expect(literal, `${file}: useTranslations(${args}) needs a string namespace`).not.toBeNull();
      used.add(literal![1]);
    }
  }

  expect([...used].filter((namespace) => !CLIENT_NAMESPACES.includes(namespace as never))).toEqual([]);
});

test("names only namespaces that exist", () => {
  expect(CLIENT_NAMESPACES.filter((namespace) => !(namespace in en))).toEqual([]);
});

test("keeps only the client namespaces", () => {
  const picked = clientMessages(en);

  expect(Object.keys(picked).sort()).toEqual([...CLIENT_NAMESPACES].sort());
  expect(picked.Chat).toBe(en.Chat);
  expect(picked).not.toHaveProperty("Home");
});
