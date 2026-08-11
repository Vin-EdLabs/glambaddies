import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            /[/\\]node_modules[/\\](react|react-dom|react-router-dom)([/\\]|$)/.test(
              id,
            )
          ) {
            return 'vendor'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3100',
      '/uploads': 'http://localhost:3100',
      '/sitemap.xml': 'http://localhost:3100',
    },
  },
})
