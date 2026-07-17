import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { i18nAutoPlugin } from 'i18n-auto-plugin/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni(), i18nAutoPlugin()],
  server: {
    port: 9999
  }
})
