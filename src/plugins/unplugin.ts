import { createUnplugin } from 'unplugin'
import path from 'node:path'
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
  /** 是否禁用插件(如 CI/调试时临时关闭转换) */
  disable?: boolean
}

/**
 * 基于 unplugin 的统一插件实现
 * 同一份代码适配 vite / webpack / rspack / rollup / esbuild 等构建工具
 * loader 注入、ESM/CJS 兼容均由 unplugin 内部处理
 */
export const I18nAuto = createUnplugin((options: Options | undefined, meta) => {
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
      if (options?.disable) return false
      init()
      const [filename, query] = id.split('?', 2)
      if (query && filename.endsWith('.vue')) {
        // webpack/rspack:vue-loader 的子请求（?vue&type=script 等）会重新
        // 从文件系统读原始文件再按 query 提取块，必须同样转换，
        // 否则主请求的转换结果被原始内容覆盖（script setup 块丢失、组件为空）
        // vite:子请求走 @vitejs/plugin-vue 的 descriptor 缓存,code 已是块内容,不可重复转换
        if (meta.framework === 'webpack' || meta.framework === 'rspack') {
          return !!config && !/node_modules/.test(filename) && filter(filename)
        }
        return false
      }
      return !!config && !/node_modules/.test(filename) && filter(filename)
    },

    transform(code, id) {
      const emitWarning = ({ text, line, column }: any) => {
        const base = `在语料库中未发现该文本【${sliceText(text)}】请更新语料库`
        if (meta.framework === 'webpack' || meta.framework === 'rspack') {
          // ModuleWarning 不读 warning.loc(见 webpack/lib/ModuleWarning.js),传 loc
          // 会被丢,故把"文件:行:列"拼进 message,终端/IDE 可识别为可点击链接
          if (line) {
            const file = path
              .relative(process.cwd(), id.split('?')[0])
              .replace(/\\/g, '/')
            this.warn(`${base} (${file}:${line}:${column})`)
          } else {
            this.warn(base)
          }
          return
        }
        // vite/rollup:loc 经 this.warn 原样透传
        this.warn({ message: base, loc: { file: id, line, column } })
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
