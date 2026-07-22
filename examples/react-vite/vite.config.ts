import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { I18nAutoPlugin } from 'i18n-auto-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  // i18n 插件放在 react 之前:同为 enforce:'pre',数组顺序决定执行序,
  // 先于 react-refresh 拿到原始源码,警告行号才与源文件一致
  plugins: [I18nAutoPlugin() as any, react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
