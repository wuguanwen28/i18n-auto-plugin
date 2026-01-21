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

const config = defineConfig({
  platform: 'node',
  input: {
    'bin': path.resolve(__dirname, './src/bin/i18n.ts'),
    'index': path.resolve(__dirname, './src/index.ts'),
    'vite-plugin': path.resolve(__dirname, './src/plugins/vite.ts'),
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
  external: [...Object.keys(pkg.dependencies)],
  plugins: [
    replace({
      values: {
        __NAME__: JSON.stringify(pkg.name),
        __VERSION__: JSON.stringify(pkg.version),
      },
    }),
  ],
})

const dtsConfig = defineConfig({
  input: {
    index: path.resolve(__dirname, './src/index.ts'),
  },
  output: [
    {
      format: 'esm',
      dir: './dist',
      chunkFileNames: 'chunks/[name].d.ts',
    },
  ],
  plugins: [dts()],
})

export default defineConfig([config, dtsConfig])
