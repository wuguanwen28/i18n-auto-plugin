import { I18nAuto, Options } from './unplugin'

/**
 * webpack 插件入口,具名导入(new 调用):
 *   const { I18nAutoPlugin } = require('i18n-auto-plugin/webpack')
 *   plugins: [new I18nAutoPlugin()]
 */
export function I18nAutoPlugin(options?: Options) {
  return I18nAuto.webpack(options)
}

export default I18nAutoPlugin
