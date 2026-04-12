import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('typescript-eslint').ConfigArray} */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "packages/engine-native/**"],
  },
  {
    files: ["packages/cli/**/*.ts", "packages/cli/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: ["packages/cli/tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["packages/cli/**/*.ts", "packages/cli/**/*.tsx"],
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
    },
  },
);
