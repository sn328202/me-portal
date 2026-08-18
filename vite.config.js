import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // Route-level code splitting lives in App.jsx; this pulls the shared
    // libraries out of the entry chunk so they cache independently of app code.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['react-icons'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  esbuild: {
    // Keep console.error/warn (used for real diagnostics), drop the rest in prod.
    pure: mode === 'production' ? ['console.log', 'console.debug'] : [],
  },
  server: {
    proxy: {
      '/api/news': {
        target: 'https://newsapi.org/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/news/, ''),
      }
    }
  }
}))
