module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:security/recommended-legacy',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:unicorn/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'security', 'import'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  rules: {
    'security/detect-non-literal-fs-filename': 0,
    'unicorn/prevent-abbreviations': 0,
    'unicorn/no-null': 0,
    'unicorn/prefer-top-level-await': 0,
    '@typescript-eslint/no-unsafe-assignment': 0,
    '@typescript-eslint/no-unsafe-member-access': 0,
    '@typescript-eslint/no-unsafe-return': 0,
    '@typescript-eslint/no-unsafe-argument': 0,
    '@typescript-eslint/no-misused-promises': 0,
  },
  reportUnusedDisableDirectives: true,
};
