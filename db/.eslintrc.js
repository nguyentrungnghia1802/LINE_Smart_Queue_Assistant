// db/.eslintrc.js — ESLint config for seed and migration TypeScript files
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@line-queue/config/eslint')],
  // No parserOptions.project — seed files are not included in any tsconfig,
  // so we skip type-aware lint rules here.
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
};
