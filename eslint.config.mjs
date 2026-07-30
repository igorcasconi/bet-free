import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Service-role Supabase client bypasses RLS — restrict it to the
    // sync services that need it, never a UI/client-side import surface.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "lib/supabase/admin is service-role only — import it from features/sports-sync/services/* exclusively.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "features/sports-sync/services/**/*.ts",
      "features/dashboard/services/**/*.ts",
      "features/matches/services/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
