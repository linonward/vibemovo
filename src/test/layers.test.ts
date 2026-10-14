// @vitest-environment node
import { ESLint } from "eslint";
import { expect, test } from "vitest";

// Lints one import as if it sat in `file`, with the repo's ESLint config,
// and returns the import rule's messages.
const eslint = new ESLint();
async function importErrors(file: string, source: string, name = "x") {
  const [result] = await eslint.lintText(`import { ${name} } from "${source}";\nexport { ${name} };\n`, {
    filePath: file,
  });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports").map((m) => m.message);
}

// docs/architecture.md § Layers: who may import whom.
test.each([
  // [file, import, allowed]
  ["src/server/images/index.ts", "@/server/db", true],
  ["src/server/images/index.ts", "@/lib/api", false],
  ["src/components/images/x.tsx", "@/lib/api", true],
  ["src/components/images/x.tsx", "@/hooks/use-mobile", true],
  ["src/components/images/x.tsx", "@/server/images", false],
  ["src/lib/x.ts", "@/i18n/routing", true],
  ["src/lib/x.ts", "@/components/ui/button", false],
  ["src/lib/x.ts", "@/hooks/use-mobile", false],
  ["src/hooks/x.ts", "@/lib/api", true],
  ["src/hooks/x.ts", "@/components/ui/button", false],
  ["src/hooks/x.ts", "@/i18n/navigation", false],
  ["src/hooks/x.ts", "@/server/db", false],
  ["src/i18n/x.ts", "next-intl", true],
  ["src/i18n/x.ts", "@/server/db", false],
  ["src/i18n/x.ts", "@/lib/api", false],
  ["src/i18n/x.ts", "@/components/ui/button", false],
  ["src/proxy.ts", "@/i18n/routing", true],
  ["src/proxy.ts", "@/server/auth", false],
  ["src/proxy.ts", "@/lib/api", false],
  // Relative paths can't get around the rules.
  ["src/lib/x.ts", "../components/ui/button", false],
  ["src/hooks/x.ts", "../components/ui/button", false],
  ["src/i18n/request.ts", "./routing", true],
  ["src/i18n/request.ts", "../../messages/en.json", true],
  ["src/i18n/request.ts", "../server/db", false],
  ["src/proxy.ts", "./i18n/routing", true],
  ["src/proxy.ts", "./server/auth", false],
])("%s importing %s: allowed %s", async (file, source, allowed) => {
  const errors = await importErrors(file, source);
  expect(errors.length === 0, errors.join("; ")).toBe(allowed);
});

test("pages read the session through currentSession, which caches it per render", async () => {
  const page = "src/app/[locale]/(dashboard)/credits/page.tsx";

  expect(await importErrors(page, "@/server/auth/session", "getSession")).toHaveLength(1);
  expect(await importErrors(page, "@/app/_lib/session", "currentSession")).toEqual([]);
  // Route handlers have their request, and no React render to share.
  expect(await importErrors("src/app/api/_lib/with-session.ts", "@/server/auth/session", "getSession")).toEqual([]);
});

test("pages read the balance and subscription through cached helpers", async () => {
  const page = "src/app/[locale]/(dashboard)/billing/page.tsx";

  expect(await importErrors(page, "@/server/credits", "getBalance")).toHaveLength(1);
  expect(await importErrors(page, "@/server/payment/subscriptions", "getCurrentSubscription")).toHaveLength(1);
  expect(await importErrors(page, "@/app/_lib/account", "userBalance")).toEqual([]);
  expect(await importErrors(page, "@/server/credits", "listTransactions")).toEqual([]);
  // The helpers wrap them.
  expect(await importErrors("src/app/_lib/account.ts", "@/server/credits", "getBalance")).toEqual([]);
});
