import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**', '**/node_modules/**', '**/coverage/**',
      '**/playwright-report/**', '**/test-results/**',
      // Legacy copies retained from the JavaScript labs; .ts files are the active source.
      'client/src/**/*.js', 'server/src/**/*.js', 'shared/**/*.js', 'server/scripts/**/*.js',
    ],
  },
  { files: ['**/*.js', '**/*.mjs'], ...js.configs.recommended,
    languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
  { files: ['**/tests/**/*.ts', 'tests/**/*.ts', '**/scripts/**/*.ts', 'e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' } },
  // node:test returns a PromiseLike in the type definitions; test registration is not awaited.
  { files: ['shared/tests/**/*.test.ts'],
    rules: { '@typescript-eslint/no-floating-promises': 'off' } },
);
