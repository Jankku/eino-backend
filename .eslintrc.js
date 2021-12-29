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
    'max-len': [1, { code: 120, ignoreUrls: true }],
    'consistent-return': 0,
    'no-plusplus': 0,
    'no-await-in-loop': 0,
    'no-explicit-any': 0,
    '@typescript-eslint/naming-convention': ['off'],
  },
};
