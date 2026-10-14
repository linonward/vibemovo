// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// API keys reach only these routes. Adding one is a decision, not a side
// effect of copying a handler: update this list and the runbook together.
const ALLOWED = [
  "images/[id]/download/route.ts",
  "images/[id]/route.ts",
  "images/route.ts",
  "videos/[id]/download/route.ts",
  "videos/[id]/route.ts",
  "videos/route.ts",
];

test("only the image and video routes accept API keys", () => {
  const root = join(process.cwd(), "src/app/api");
  const routes = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith("route.ts"));

  const withKeys = routes.filter((file) => readFileSync(join(root, file), "utf8").includes("apiKey: true"));
  expect(withKeys.sort()).toEqual(ALLOWED);
});
