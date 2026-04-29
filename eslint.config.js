import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { 
    ignores: [
      "dist",
      "build/**",
      "artifacts/**",
      "ios/**",
      "android/**",
      "node_modules/**",
      ".venv/**",
      "**/.venv/**",
      "**/*.xcframework/**",
      "**/.build/**"
    ] 
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-console": ["warn", { allow: ["error"] }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: ["src/lib/silenceDebugLogs.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: [
      "src/App.tsx",
      "src/hooks/**/*.{ts,tsx}",
      "src/services/**/*.{ts,tsx}",
      "src/lib/locationHelpers.ts",
      "src/utils/logger.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
);
