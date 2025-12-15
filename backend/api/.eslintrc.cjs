/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', 'bundle/', 'node_modules/', '*.js', '*.zip'],
  rules: {
    // The codebase currently uses `any` in several integration boundaries (AWS SDK, external payloads, etc.)
    '@typescript-eslint/no-explicit-any': 'off',
    // Allow unused underscore-prefixed args/vars (common in route handlers)
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
};


