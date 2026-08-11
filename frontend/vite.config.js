import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Vite 8 / Rolldown — avoid esbuild-specific minify setting
    minify: true,
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
  // Proxy is development-only (`vite` / `vite preview` use server config; production build does not)
  ...(command === 'serve'
    ? {
        server: {
          port: 5173,
          proxy: {
            '/api': 'http://localhost:3100',
            '/uploads': 'http://localhost:3100',
            '/sitemap.xml': 'http://localhost:3100',
          },
        },
      }
    : {}),
}))
