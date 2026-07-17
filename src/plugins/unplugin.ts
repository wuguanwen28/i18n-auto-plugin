import { createUnplugin } from 'unplugin'
import { transformWithBabel } from './babel-transform'
import { rewriteVueSfc } from './vue-sfc'
import { Configuration, LanguagesMapById } from '../types'
import {
  createFilter,
  getConfiguration,
  readLanguagesMap,
  sliceText,
} from '../utils'

export type Options = {
  /** i18n 配置文件路径，默认自动查找 i18n.config.js */
  configPath?: string
}

/**
 * 基于 unplugin 的统一插件实现
 * 同一份代码适配 vite / webpack / rspack / rollup / esbuild 等构建工具
 * loader 注入、ESM/CJS 兼容均由 unplugin 内部处理
 */
export const I18nAuto = createUnplugin<Options | undefined>((options) => {
  const { configPath = '' } = options || {}

  let config: Configuration | null = null
  let filter: ReturnType<typeof createFilter>
  let lngMap: LanguagesMapById = {}

  const init = () => {
    if (config) return
    config = getConfiguration(configPath)
    filter = createFilter(config)
    if (config) lngMap = readLanguagesMap(config) || {}
  }

  return {
    name: 'i18n-auto-plugin',
    // 必须在框架编译器（@vitejs/plugin-vue / vite-plugin-uni）之前
    // 拿到 SFC/TSX 源码，转换后交还给它们编译
    enforce: 'pre',

    transformInclude(id) {
      init()
      // .vue 带 query 的子请求（?vue&type=style 等）只处理主请求
      const [filename, query] = id.split('?', 2)
      if (query && filename.endsWith('.vue')) return false
      return !!config && !/node_modules/.test(filename) && filter(filename)
    },

    transform(code, id) {
      const emitWarning = ({ text, line, column }: any) => {
        this.warn(
          `在语料库中未发现该文本【${sliceText(text)}】请更新语料库 (${id}:${line}:${column})`,
        )
      }

      const importInfo = {
        source: __NAME__,
        imported: 'i18n',
        local: '_i18n',
        ...(config!.importInfo || {}),
      }

      // .vue：源码级改写 template（文本 → 插值），script 交给框架编译后续处理
      if (id.split('?', 2)[0].endsWith('.vue')) {
        const res = rewriteVueSfc(code, {
          filePath: id,
          config: config!,
          lngMap,
          importInfo,
          emitWarning,
        })
        return res ?? null
      }

      // js/ts/jsx/tsx：babel AST 转换
      const res = transformWithBabel({
        code,
        filePath: id,
        config: config!,
        lngMap,
        emitWarning,
      })
      return res ?? null
    },
  }
})
