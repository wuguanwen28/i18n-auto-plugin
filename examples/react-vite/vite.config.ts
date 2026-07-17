import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { i18nAutoPlugin } from 'i18n-auto-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), i18nAutoPlugin() as any],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
