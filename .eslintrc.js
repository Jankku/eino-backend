module.exports = {
  root: true,
  plugins: ["@typescript-eslint", "security"],
  extends: [
    "airbnb-base",
    "airbnb-typescript/base",
    "plugin:security/recommended",
    "plugin:import/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
  },
  rules: {
    "max-len": [1, { code: 120, ignoreUrls: true }],
    "consistent-return": 0,
    "@typescript-eslint/naming-convention": ["off"],
  },
};
