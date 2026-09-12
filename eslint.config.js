import js from "@eslint/js"
import ts from "typescript-eslint"
import svelte from "eslint-plugin-svelte"
import prettier from "eslint-config-prettier"
import globals from "globals"

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs["flat/recommended"],
  prettier,
  ...svelte.configs["flat/prettier"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
    rules: {
      // eslint doesn't see type parameters declared by <script generics="...">
      "no-undef": "off",
      // A `$bindable()` prop with no fallback reads as an assignment nothing consumes, since the
      // parent is what consumes it.
      "no-useless-assignment": "off",
    },
  },
  {
    ignores: ["build/", ".svelte-kit/", "dist/"],
  },
  {
    rules: {
      "a11y-click-events-have-key-events": "off",
      "a11y-autofocus": "off",
      "no-constant-condition": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
      "no-extra-semi": "off",
      "no-async-promise-executor": "off",
      "prefer-const": ["error", {destructuring: "all"}],
      "no-eq-null": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[raw='null']:not(CallExpression[callee.property.name='stringify'] > Literal)",
          message: "Use undefined instead of null.",
        },
      ],
      "svelte/valid-compile": "off",
      "svelte/no-at-html-tags": "off",
      "svelte/no-navigation-without-resolve": "off",
      "svelte/prefer-svelte-reactivity": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-extra-semi": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {args: "none", destructuredArrayIgnorePattern: "^_d?$", caughtErrors: "none"},
      ],
    },
  },
]
