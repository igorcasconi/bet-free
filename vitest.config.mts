import path from "node:path";

import { loadEnv } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

const JSDOM_GLOBS = [
  "tests/features/dashboard/components/**",
  "tests/features/navigation/**",
  "tests/features/landing/components/**",
  "tests/features/matches/components/**",
  "tests/features/matches/hooks/**",
  "tests/features/profile/components/**",
  "tests/features/auth/hooks/**",
];

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    passWithNoTests: true,
    env: loadEnv("", process.cwd(), ""),
    // NOTE: `environmentMatchGlobs` was removed in Vitest 4 (installed: 4.1.10).
    // `test.projects` with per-project `environment` is the current equivalent.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          exclude: [...configDefaults.exclude, ...JSDOM_GLOBS],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: JSDOM_GLOBS,
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
