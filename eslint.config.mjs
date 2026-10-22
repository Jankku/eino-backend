import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import security from 'eslint-plugin-security';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['node_modules/', 'dist/']),
  {
    files: ['src/**/*.ts', 'migrations/*.ts'],
    extends: [
      js.configs.recommended,
      tsPlugin.configs['flat/recommended-type-checked'],
      security.configs.recommended,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
      unicorn.configs.recommended,
      prettier,
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: './tsconfig.eslint.json',
        }),
      ],
    },
    rules: {
      'security/detect-non-literal-fs-filename': 0,
      'unicorn/prevent-abbreviations': 0,
      'unicorn/prefer-top-level-await': 0,
      'unicorn/consistent-boolean-name': 0,
      'unicorn/name-replacements': 0,
      'unicorn/max-nested-calls': 0,
      'unicorn/no-non-function-verb-prefix': 0,
      'unicorn/no-top-level-side-effects': 0,
      'unicorn/prefer-number-coercion': 0,
      'unicorn/prefer-logical-operator-over-ternary': 0,
      'unicorn/prefer-await': 0,
      '@typescript-eslint/no-unsafe-assignment': 0,
      '@typescript-eslint/no-unsafe-member-access': 0,
      '@typescript-eslint/no-unsafe-return': 0,
      '@typescript-eslint/no-misused-promises': 0,
      'import-x/no-named-as-default': 0,
      'import-x/no-named-as-default-member': 0,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
]);
