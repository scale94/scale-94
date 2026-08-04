module.exports = {
  root: true,
  // es2021 (not es2020) because the wasm-bindgen glue and several hooks use
  // FinalizationRegistry / WeakRef, which are ES2021 globals.
  env: { browser: true, es2021: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    '.eslintrc.cjs',
    // wasm-bindgen output, checked in as three identical copies. Vendored
    // build product — its UMD wrapper trips no-undef on module/global/self.
    '**/scale94_kernels.js',
    // Written by `npm run kernel:import`; the files say DO NOT EDIT MANUALLY.
    // Linting them only ever reports bugs in the generator, which have to be
    // fixed there — editing the output is overwritten on the next import.
    'src/terminal/data/*.generated.js',
  ],
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
    {
      // Vitest runs with `globals: true` (vitest.config.js), so the suite may
      // use describe/it/expect/vi without importing them. Tests run in jsdom,
      // so they need browser globals back — the node override above matches
      // `*.js` by basename at any depth and would otherwise strip them.
      files: [
        'tests/**/*.{js,jsx}',
        'src/**/__tests__/**/*.{js,jsx}',
        '**/*.test.{js,jsx}',
      ],
      env: { browser: true, node: true },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        suite: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    {
      // react-three-fiber scenes. r3f turns the whole three.js namespace into
      // JSX intrinsics (<mesh>, <shaderMaterial>, <bufferAttribute>...), and
      // eslint-plugin-react only knows DOM elements — so it reads every
      // three.js prop (attach, args, position, itemSize, ...) as an unknown
      // DOM attribute. The rule cannot be scoped by element, only by file, and
      // an `ignore` list of prop names would need topping up for every new
      // three.js property the scenes reach for. Scoped off here instead; the
      // rule stays on everywhere else, where it still catches class/onclick.
      files: [
        'src/terminal/mercury/**/*.jsx',
        'src/terminal/air/**/*.jsx',
        'src/terminal/earth/**/*.jsx',
        'src/terminal/thermal/**/*.jsx',
        'src/terminal/fluid/**/*.jsx',
        'src/terminal/art/**/*.jsx',
        'src/terminal/views/manifesto/**/*.jsx',
        'src/terminal/views/ArtTab.jsx',
      ],
      rules: { 'react/no-unknown-property': 'off' },
    },
  ],
};
