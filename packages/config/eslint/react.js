// React + TypeScript ESLint config
// Usage: require('@line-queue/config/eslint/react')
const base = require('./index');

/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...base,
  env: {
    ...base.env,
    browser: true,
  },
  extends: [
    ...base.extends,
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: [...(base.plugins ?? []), 'react', 'react-hooks', 'react-refresh'],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    ...base.rules,
    // React 17+ JSX transform — no need to import React
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
