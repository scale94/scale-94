import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
