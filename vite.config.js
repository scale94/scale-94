import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api/* to the Vercel dev server (default port 3000) when running
    // `vite dev` alongside `vercel dev --listen 3001`.
    // For normal development, use `vercel dev` which serves both together.
    proxy: {
      '/api': {
        target:       process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ['**/*.md'],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Explicit naming prevents Rollup 4 from emitting .df.js "dynamic-format" wrappers
        // that some servers / Firefox Android fail to load correctly.
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks: {
          vendor: ['react', 'react-dom'],
          lucide: ['lucide-react'],
        },
      },
    },
  },
})
