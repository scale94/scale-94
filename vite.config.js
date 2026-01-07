import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuration for asset inclusion
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.md'],
})