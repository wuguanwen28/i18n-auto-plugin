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

// 编译时代码的外部依赖（不打进产物）
// 注意：unplugin 必须 external —— 它通过 import.meta.dirname 定位
// 自身的 webpack loader 文件，打进 bundle 会破坏该路径解析
const external = ['vite', 'webpack', ...Object.keys(pkg.dependencies)]

/**
 * 打包分为三类运行环境：
 * 1. 浏览器运行时（src/index.ts）—— 用户页面中执行，禁止出现 node 依赖
 * 2. Node ESM —— bin 命令行 + 构建插件（vite/webpack，基于 unplugin）
 * 3. Node CJS —— 构建插件（兼容 CJS 的 webpack/vite 配置文件）
 *
 * webpack 的 loader 注入由 unplugin 内部处理，本包不再产出 loader。
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

// 2) Node ESM：bin + 构建插件
const nodeEsmConfig = defineConfig({
  platform: 'node',
  input: {
    'bin': resolve('./src/bin/i18n.ts'),
    'vite-plugin': resolve('./src/plugins/vite.ts'),
    'webpack-plugin': resolve('./src/plugins/webpack.ts'),
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

// 3) Node CJS：构建插件（require 方式加载的 webpack/vite 配置）
//    unplugin 为 ESM-only，CJS 产物通过 require(esm) 加载它，
//    需要 Node >= 20.19 / 22.12
const nodeCjsConfig = defineConfig({
  platform: 'node',
  input: {
    'vite-plugin': resolve('./src/plugins/vite.ts'),
    'webpack-plugin': resolve('./src/plugins/webpack.ts'),
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

export default defineConfig([
  runtimeConfig,
  nodeEsmConfig,
  nodeCjsConfig,
]) as ConfigExport
