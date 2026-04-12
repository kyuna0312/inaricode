import eslint from "@eslint/js";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

/** @type {import('typescript-eslint').ConfigArray} */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "packages/engine-native/**"],
  },
  {
    // Turborepo runs `yarn lint` with cwd `packages/cli`; local/CI may run from repo root — cover both.
    files: [
      "packages/cli/**/*.ts",
      "packages/cli/**/*.tsx",
      "src/**/*.ts",
      "src/**/*.tsx",
      "test/**/*.ts",
    ],
    plugins: { unicorn },
    languageOptions: {
      parserOptions: {
        project: ["packages/cli/tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [
      "packages/cli/**/*.ts",
      "packages/cli/**/*.tsx",
      "src/**/*.ts",
      "src/**/*.tsx",
      "test/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",

      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "typeLike", format: ["PascalCase"] },
        {
          selector: "class",
          format: ["PascalCase"],
          leadingUnderscore: "forbid",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          modifiers: ["const"],
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: null,
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "objectLiteralProperty",
          format: null,
        },
        {
          selector: "typeProperty",
          format: null,
        },
      ],

      "unicorn/filename-case": ["error", { case: "kebabCase" }],
    },
  },
);
