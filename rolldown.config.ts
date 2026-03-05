import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import replace from '@rollup/plugin-replace'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url)).toString(),
)

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const replacePlugin = replace({
  values: {
    __NAME__: JSON.stringify(pkg.name),
    __VERSION__: JSON.stringify(pkg.version),
  },
})

const webpackPath = (name: 'plugin' | 'loader') =>
  path.resolve(__dirname, `./src/plugins/webpack/${name}.ts`)

const baseConfig = defineConfig({
  platform: 'node',
  input: {
    'bin': path.resolve(__dirname, './src/bin/i18n.ts'),
    'index': path.resolve(__dirname, './src/index.ts'),
    'vite-plugin': path.resolve(__dirname, './src/plugins/vite.ts'),
    'webpack-plugin': webpackPath('plugin'),
  },
  output: [
    {
      dir: './dist',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name].js',
      exports: 'named',
      format: 'esm',
      externalLiveBindings: false,
    },
  ],
  external: ['vite', ...Object.keys(pkg.dependencies)],
  plugins: [dts(), replacePlugin],
})

const commonjsConfig = defineConfig({
  input: {
    'webpack-plugin': webpackPath('plugin'),
    'webpack-loader': webpackPath('loader'),
    'vite-plugin': path.resolve(__dirname, './src/plugins/vite.ts'),
  },
  output: [
    {
      dir: './dist/cjs',
      entryFileNames: '[name].cjs',
      chunkFileNames: 'chunks/[name].cjs',
      format: 'cjs',
    },
  ],
  plugins: [replacePlugin],
  external: baseConfig.external,
})

export default defineConfig([baseConfig, commonjsConfig])
