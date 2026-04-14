// apps/web/.eslintrc.cjs
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@line-queue/config/eslint/react')],
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  // CJS config files are not TypeScript — disable typed-linting for them.
  overrides: [
    {
      files: ['*.cjs', '*.mjs', '*.js'],
      parserOptions: { project: null },
    },
  ],
};
