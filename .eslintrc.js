// @rushstack/eslint-patch/modern-module-resolution fixes the ESLint plugin
// conflict that occurs with pnpm when the same plugin is loaded from two
// different paths in the virtual store (e.g. @typescript-eslint/eslint-plugin
// loaded by both @excalidraw/eslint-config and eslint-config-react-app).
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  extends: ["@excalidraw/eslint-config", "react-app"],
  rules: {
    "import/order": [
      "warn",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
          "object",
          "type",
        ],
        pathGroups: [
          {
            pattern: "@excalidraw/**",
            group: "external",
            position: "after",
          },
        ],
        "newlines-between": "always-and-inside-groups",
        warnOnUnassignedImports: true,
      },
    ],
    "import/no-anonymous-default-export": "off",
    "no-restricted-globals": "off",
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        prefer: "type-imports",
        disallowTypeAnnotations: false,
        fixStyle: "separate-type-imports",
      },
    ],
    "no-restricted-imports": [
      "error",
      {
        name: "jotai",
        message:
          'Do not import from "jotai" directly. Use our app-specific modules ("editor-jotai" or "app-jotai").',
      },
    ],
    "react/jsx-no-target-blank": [
      "error",
      {
        allowReferrer: true,
      },
    ],
  },
  overrides: [
    {
      // @typescript-eslint/consistent-type-imports requires type information
      // in v8+, which is unavailable for plain JS files parsed by babel.
      files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
      rules: {
        "@typescript-eslint/consistent-type-imports": "off",
      },
    },
    {
      files: ["packages/excalidraw/**/*.{ts,tsx}"],
      excludedFiles: [
        "packages/excalidraw/**/*.test.{ts,tsx}",
        "packages/excalidraw/**/*.test.*.{ts,tsx}",
      ],
      rules: {
        "@typescript-eslint/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@excalidraw/excalidraw"],
                message:
                  "Do not import from the barrel 'index.tsx' files. Use direct relative imports to the specific module instead.",
                allowTypeImports: true,
              },
            ],
            paths: [
              ".",
              "..",
              "../..",
              "../../..",
              "../../../..",
              "../../../../..",
              "../index",
              "../../index",
              "../../../index",
              "../../../../index",
            ],
          },
        ],
      },
    },
  ],
};
