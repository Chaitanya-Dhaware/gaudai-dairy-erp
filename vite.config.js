import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Target modern browsers for smaller output
    target: 'es2020',
    // Increase chunk size warning limit (recharts is large)
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        // Vite 8 / Rolldown requires manualChunks as a function
        manualChunks(id) {
          // Firebase SDK — loaded once, cached long-term
          if (id.includes('firebase/')) {
            return 'firebase';
          }
          // Recharts — only needed on Accounts page
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts';
          }
          // Core vendor — React, state management, toasts
          if (id.includes('react-dom') || id.includes('zustand') || id.includes('react-hot-toast') || id.includes('react-hook-form')) {
            return 'vendor';
          }
          // i18n — translation system
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n';
          }
        }
      }
    }
  }
})
