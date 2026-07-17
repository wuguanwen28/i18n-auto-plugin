import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type ConfigExport } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import replace from '@rollup/plugin-replace'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url)).toString(),
)

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const resolve = (p: string) => path.resolve(__dirname, p)

// 构建期注入包名和版本号，避免源码硬编码
const replacePlugin = () =>
  replace({
    preventAssignment: true,
    values: {
      __NAME__: JSON.stringify(pkg.name),
      __VERSION__: JSON.stringify(pkg.version),
    },
  })

// 编译时代码的外部依赖（不打进产物）；运行时代码无任何依赖，不需要
const external = ['vite', 'webpack', ...Object.keys(pkg.dependencies)]

/**
 * 打包分为三类运行环境：
 * 1. 浏览器运行时（src/index.ts）—— 用户页面中执行，禁止出现 node 依赖
 * 2. Node ESM —— bin 命令行 + vite/webpack 插件（编译时）
 * 3. Node CJS —— vite/webpack 插件 + webpack loader（兼容 CJS 项目）
 *
 * webpack loader 特殊：必须是 CJS 格式，且 ESM/CJS 两份插件产物都通过
 * require.resolve('./webpack-loader.cjs') 引用它，因此 dist/ 和 dist/cjs/
 * 各需要一份 loader（见 loaderForEsmDist）。
 */

// 1) 浏览器运行时
const runtimeConfig = defineConfig({
  platform: 'browser',
  input: { index: resolve('./src/index.ts') },
  output: {
    dir: './dist',
    format: 'esm',
    entryFileNames: '[name].js',
    externalLiveBindings: false,
  },
  plugins: [dts(), replacePlugin()],
})

// 2) Node ESM：bin + 编译时插件
const nodeEsmConfig = defineConfig({
  platform: 'node',
  input: {
    'bin': resolve('./src/bin/i18n.ts'),
    'vite-plugin': resolve('./src/plugins/vite/plugin.ts'),
    'webpack-plugin': resolve('./src/plugins/webpack/plugin.ts'),
  },
  output: {
    dir: './dist',
    format: 'esm',
    entryFileNames: '[name].js',
    chunkFileNames: 'chunks/[name].js',
    exports: 'named',
    externalLiveBindings: false,
  },
  external,
  plugins: [dts(), replacePlugin()],
})

// 3) Node CJS：编译时插件 + loader
const nodeCjsConfig = defineConfig({
  platform: 'node',
  input: {
    'vite-plugin': resolve('./src/plugins/vite/plugin.ts'),
    'webpack-plugin': resolve('./src/plugins/webpack/plugin.ts'),
    'webpack-loader': resolve('./src/plugins/webpack/loader.ts'),
  },
  output: {
    dir: './dist/cjs',
    format: 'cjs',
    entryFileNames: '[name].cjs',
    chunkFileNames: 'chunks/[name].cjs',
  },
  external,
  plugins: [replacePlugin()],
})

// 4) 给 ESM 产物目录补一份 CJS loader
//    修复：dist/webpack-plugin.js 中 require.resolve('./webpack-loader.cjs') 找不到文件
const loaderForEsmDist = defineConfig({
  platform: 'node',
  input: { 'webpack-loader': resolve('./src/plugins/webpack/loader.ts') },
  output: {
    dir: './dist',
    format: 'cjs',
    entryFileNames: '[name].cjs',
    chunkFileNames: 'chunks/[name]-loader.cjs',
  },
  external,
  plugins: [replacePlugin()],
})

export default defineConfig([
  runtimeConfig,
  nodeEsmConfig,
  nodeCjsConfig,
  loaderForEsmDist,
]) as ConfigExport
