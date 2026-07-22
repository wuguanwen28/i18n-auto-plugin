import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { I18nAutoPlugin } from 'i18n-auto-plugin/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni(), I18nAutoPlugin()],
  server: {
    port: 9999
  }
})
