// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// The build bakes NEXT_PUBLIC_* variables into the browser code, so the
// Dockerfile must take each as a build argument, and the runbook's build
// command must pass it. Vercel Web Analytics works only on Vercel.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const VERCEL_ONLY = ["NEXT_PUBLIC_VERCEL_ANALYTICS"];

const publicVariables = [...read(".env.example").matchAll(/^(NEXT_PUBLIC_\w+)=/gm)]
  .map(([, name]) => name)
  .filter((name) => !VERCEL_ONLY.includes(name));

test("the Dockerfile takes BETTER_AUTH_URL and every NEXT_PUBLIC_ variable as build arguments", () => {
  const args = [...read("Dockerfile").matchAll(/^ARG (\w+)$/gm)].map(([, name]) => name);

  expect(args.sort()).toEqual(["BETTER_AUTH_URL", ...publicVariables].sort());
});

test("the runbook's docker build command passes every build argument", () => {
  const section = read("docs/runbook.md").split("## Self-host with Docker")[1].split("\n## ")[0];
  const passed = [...section.matchAll(/--build-arg (\w+)=/g)].map(([, name]) => name);

  expect(passed.sort()).toEqual(["BETTER_AUTH_URL", ...publicVariables].sort());
});
