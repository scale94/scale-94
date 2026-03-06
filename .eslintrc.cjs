module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '19' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // PropTypes are not used in this project (React 19, no TypeScript needed).
    'react/prop-types': 'off',
    // React 19 JSX transform — no need to import React for JSX.
    'react/react-in-jsx-scope': 'off',
    // ^_ prefix ignores intentionally unused vars; React is exempt because
    // React 19 JSX transform doesn't require it in scope but many files still
    // import it for clarity or legacy reasons — not a real bug.
    'no-unused-vars': ['warn', { varsIgnorePattern: '^(_|React$)', argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Node.js utility scripts at root and in scripts/ or content/ directories.
      // Excludes src/ so browser globals (requestAnimationFrame, MutationObserver)
      // remain valid inside hooks and components.
      files: ['*.js', 'scripts/**/*.js', 'content/**/*.js'],
      excludedFiles: ['src/**'],
      env: { node: true, browser: false },
    },
  ],
};
