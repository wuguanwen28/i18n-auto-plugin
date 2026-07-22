import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { I18nAutoPlugin } from 'i18n-auto-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx(), I18nAutoPlugin() as Plugin]
})
