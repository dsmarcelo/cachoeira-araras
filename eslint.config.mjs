import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  // Next.js 16 removed `next lint`; these official flat-config exports let the
  // project use the ESLint CLI directly while keeping Next.js, React, and Core
  // Web Vitals rules aligned with the installed Next version.
  ...nextVitals,
  ...nextTs,

  // Preserve the stricter type-aware rules the project already had in
  // .eslintrc.cjs. `projectService` is the current typescript-eslint best
  // practice for typed linting because it reuses TypeScript's project service
  // instead of manually wiring every tsconfig path.
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],

      // Next.js 16's ESLint preset includes React Compiler readiness rules.
      // They are valuable, but this upgrade intentionally avoids refactoring
      // unrelated carousel/date-picker/sidebar behavior. Keep these as a
      // follow-up hardening task so the framework migration does not alter UI
      // runtime behavior.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
    },
  },

  // Keep generated artifacts and dependency folders out of direct CLI linting.
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    // E2E payment scripts are plain Node .mjs utilities executed by npm
    // scripts. They are still tested by `pnpm test:payments`; excluding them
    // keeps typed App Router linting focused on application source files.
    "scripts/payment-e2e/**/*.mjs",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
