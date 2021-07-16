module.exports = {
    root: true,
    plugins: [
      "security"
    ],
    extends: [
      "airbnb-typescript/base",
      "plugin:security/recommended"
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
      project: "./tsconfig.eslint.json",
    },
    rules: {
      "linebreak-style": 0,
      "consistent-return": 0
    },
}
