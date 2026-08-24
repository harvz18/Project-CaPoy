module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['.expo', 'dist', 'node_modules', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
}
