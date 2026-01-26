import type { Plugin } from 'vite'

import { I18nPlugin } from './core'
import { Configuration, LanguagesMap } from '../types'
import { createFilter, getConfiguration, readLanguagesMap } from '../utils'

type Options = {
  configPath?: string
  warn?: boolean
}

export function i18nAutoPlugin(options?: Options): Plugin {
  const { configPath = '' } = options || {}
  let config: Configuration | null
  let filter: ReturnType<typeof createFilter>
  let lngMap: LanguagesMap | { [id: string]: string } = {}
  return {
    name: 'vite-plugin-i18n-auto',
    configResolved() {
      config = getConfiguration(configPath)
      filter = createFilter(config)
      if (config) lngMap = readLanguagesMap(config) || {}
    },
    transform: function (code: string, id: string) {
      if (!/node_modules/.test(id) && filter(id) && config) {
        let res = I18nPlugin({
          code: code,
          filePath: id,
          config: config,
          lngMap: lngMap,
          emitWarning: this.warn.bind(this),
        })
        if (res) return res
      }
      return { code, map: null }
    },
  }
}
