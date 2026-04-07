// apps/api/.eslintrc.js
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@line-queue/config/eslint')],
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  // JS config files (jest.config.js, .eslintrc.js, etc.) are not TypeScript —
  // disable typed-linting for them to avoid "not included in tsconfig" errors.
  overrides: [
    {
      files: ['*.js', '*.cjs', '*.mjs'],
      parserOptions: { project: null },
    },
  ],
};
