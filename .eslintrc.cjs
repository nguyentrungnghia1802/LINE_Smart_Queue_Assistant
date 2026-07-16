/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@line-queue/config/eslint')],
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ['**/*.cjs', '**/*.mjs', '**/*.js'],
      parserOptions: { project: null },
      rules: { 'no-console': 'off' },
    },
  ],
};
