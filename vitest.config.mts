import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const dotenv = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // next-intl imports "next/navigation" without an extension, which Node's
    // ESM resolver rejects; let Vite resolve it instead.
    server: { deps: { inline: ["next-intl"] } },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.int.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.{ts,tsx}"],
          env: { ...dotenv, ...process.env },
        },
      },
    ],
  },
});
