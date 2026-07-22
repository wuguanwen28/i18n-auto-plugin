import { defineConfig } from 'rolldown'
import babel from '@rolldown/plugin-babel'
import { i18nAutoPlugin } from 'i18n-auto-plugin/rolldown'

// i18n 插件放在 babel 之前:enforce:'pre' 先拿原始源码改写,babel 再处理 jsx
export default defineConfig({
  input: './src/main.tsx',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    i18nAutoPlugin() as any,
    babel({ presets: ['@babel/preset-react'] }) as any,
  ],
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
})
