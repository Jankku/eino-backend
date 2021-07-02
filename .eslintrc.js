module.exports = {
    root: true,
    extends: ["airbnb-typescript/base"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
      project: "./tsconfig.eslint.json",
    },
    rules: {
      "linebreak-style": 0,
      "no-console": "off",
      "consistent-return": 0
    },
}
