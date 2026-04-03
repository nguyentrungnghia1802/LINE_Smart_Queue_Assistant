// Base ESLint config — Node.js / TypeScript
// Usage: require('@line-queue/config/eslint')
/** @type {import('eslint').Linter.Config} */
module.exports = {
  env: {
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  plugins: ['@typescript-eslint', 'simple-import-sort'],
  rules: {
    // ── Import sorting ────────────────────────────────────────────────────────
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          // Side-effect imports (e.g. import './polyfills')
          ['^\\u0000'],
          // Node built-ins — prefer node: prefix
          ['^node:'],
          // External packages
          ['^@?\\w'],
          // Internal monorepo packages
          ['^@line-queue/'],
          // Parent directory imports
          ['^\\.\\./'],
          // Relative imports
          ['^\\.'],
        ],
      },
    ],
    'simple-import-sort/exports': 'error',
    // ── TypeScript ────────────────────────────────────────────────────────────
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    // ── General ───────────────────────────────────────────────────────────────
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'eqeqeq': ['error', 'always'],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      // Relax rules for test files
      files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts'],
      env: { jest: true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
