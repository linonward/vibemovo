import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const localeUnawareNavigation = [
  {
    name: "next/link",
    message: "Use Link from @/i18n/navigation so URLs keep the locale.",
  },
  {
    name: "next/navigation",
    importNames: ["redirect", "permanentRedirect", "useRouter", "usePathname"],
    message: "Use the helpers from @/i18n/navigation so URLs keep the locale.",
  },
];

// One icon set: Lucide (stroke set globally in globals.css).
const otherIconLibraries = {
  group: [
    "react-icons",
    "react-icons/*",
    "@heroicons/*",
    "@tabler/icons-react",
    "@radix-ui/react-icons",
    "@phosphor-icons/*",
    "@fortawesome/*",
  ],
  message: "Use lucide-react for icons.",
};

// Bans importing src/server or src/app, plus `extra` patterns.
function frontend(files, extra = []) {
  return {
    files,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: localeUnawareNavigation,
          patterns: [
            otherIconLibraries,
            {
              group: ["@/server", "@/server/**", "@/app", "@/app/**"],
              message:
                "Frontend code must not import src/server or src/app; call the API instead.",
            },
            {
              regex: "^(\\.\\./)+(.*/)?(server|app)(/.*)?$",
              message:
                "Frontend code must not import src/server or src/app; call the API instead.",
            },
            ...extra,
          ],
        },
      ],
    },
  };
}

// Bans the given src/ folders, by alias or by a relative path that climbs
// into them. Returns two patterns; spread them in.
function only(layer, banned) {
  const message = `${layer} must not import src/${banned.join(" or src/")}.`;
  return [
    { group: banned.flatMap((dir) => [`@/${dir}`, `@/${dir}/**`]), message },
    { regex: `^(\\.\\./)+(.*/)?(${banned.join("|")})(/.*)?$`, message },
  ];
}

// Bans every @/ import except src/i18n, and relative paths out of `layer`
// (`relative` matches them). Returns two patterns; spread them in.
function i18nOnly(layer, relative) {
  const message = `${layer} may import only src/i18n and npm packages.`;
  return [
    { group: ["@/*", "!@/i18n", "!@/i18n/**"], message },
    { regex: relative, message },
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // src/server modules depend only on each other and npm packages, so they
  // can move to a separate service later.
  {
    files: ["src/server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*", "!@/server", "!@/server/**"],
              message: "src/server may only import from src/server.",
            },
            // The same rule for relative paths that climb out of src/server.
            {
              regex: "^(\\.\\./)+(.*/)?(app|components|lib|hooks|i18n)(/.*)?$",
              message: "src/server may only import from src/server.",
            },
          ],
        },
      ],
    },
  },
  // Frontend code talks to the server over HTTP, never by import, and
  // navigates with the locale-aware helpers. ESLint keeps only the last
  // no-restricted-imports per file, so each layer lists all of its bans.
  frontend(["src/components/**"]),
  // Shared utilities and hooks sit below the UI.
  frontend(["src/lib/**"], only("src/lib", ["components", "hooks"])),
  frontend(["src/hooks/**"], only("src/hooks", ["components", "i18n"])),
  // Routing and locale setup, which everything else builds on.
  {
    files: ["src/i18n/**"],
    rules: {
      // Climbing out of src/i18n reaches the rest of src; messages/ is two up.
      "no-restricted-imports": ["error", { patterns: i18nOnly("src/i18n", "^\\.\\./(?!\\.\\./messages/)") }],
    },
  },
  // The proxy runs before every page: routing only, no app code.
  {
    files: ["src/proxy.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: i18nOnly("src/proxy.ts", "^\\.\\.?/(?!i18n/)") }],
    },
  },
  {
    files: ["src/app/[[]locale]/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...localeUnawareNavigation,
            // React's cache shares one lookup per render; these functions don't.
            {
              name: "@/server/auth/session",
              importNames: ["getSession"],
              message: "Use currentSession from @/app/_lib/session, which reads the session once per render.",
            },
            {
              name: "@/server/credits",
              importNames: ["getBalance"],
              message: "Use userBalance from @/app/_lib/account, which reads the balance once per render.",
            },
            {
              name: "@/server/payment/subscriptions",
              importNames: ["getCurrentSubscription"],
              message: "Use userSubscription from @/app/_lib/account, which reads it once per render.",
            },
          ],
          patterns: [otherIconLibraries],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
