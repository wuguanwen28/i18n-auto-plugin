import { createUnplugin } from 'unplugin'
import { I18nPlugin } from './core'
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

    transformInclude(id) {
      init()
      return !!config && !/node_modules/.test(id) && filter(id)
    },

    transform(code, id) {
      const res = I18nPlugin({
        code,
        filePath: id,
        config: config!,
        lngMap,
        emitWarning: ({ text, line, column }) => {
          this.warn(
            `在语料库中未发现该文本【${sliceText(text)}】请更新语料库 (${id}:${line}:${column})`,
          )
        },
      })
      return res ?? null
    },
  }
})
