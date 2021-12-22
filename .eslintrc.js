module.exports = {
  root: true,
  plugins: ['security'],
  extends: ['airbnb-typescript/base', 'plugin:security/recommended', 'plugin:import/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  rules: {
    'linebreak-style': 0,
    'consistent-return': 0,
    '@typescript-eslint/naming-convention': ['off'],
  },
};
