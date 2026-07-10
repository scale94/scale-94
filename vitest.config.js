import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { transformWithOxc } from 'vite';

// Pre-plugin: transform .js test files that contain JSX using OXC with jsx lang.
// Vite 8 OXC defaults lang from file extension (.js → plain JS, no JSX support),
// so this plugin manually handles the transform before vite:oxc sees the file.
const jsxInJsPlugin = {
  name: 'jsx-in-js-tests',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.endsWith('.test.js') && !id.endsWith('.spec.js')) return null;
    if (!code.includes('<') || !/<[A-Z]/.test(code)) return null;
    const result = await transformWithOxc(code, id, {
      lang: 'jsx',
      jsx: { runtime: 'automatic', importSource: 'react' },
    });
    return { code: result.code, map: result.map };
  },
};

export default defineConfig({
  plugins: [jsxInJsPlugin, react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js', 'src/**/__tests__/**/*.test.{js,jsx}'],
  },
  resolve: {
    alias: { '@': '/src' },
  },
});
