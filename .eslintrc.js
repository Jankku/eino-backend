module.exports = {
  root: true,
  plugins: ['@typescript-eslint', 'security', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    'consistent-return': 0,
    'no-plusplus': 0,
    '@typescript-eslint/naming-convention': ['off'],
    'security/detect-non-literal-fs-filename': 0,
  },
};
