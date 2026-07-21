import { I18nAuto, Options } from './unplugin'

/**
 * 兼容 `new I18nAutoRspackPlugin()` 与 `I18nAutoRspackPlugin()` 两种调用方式
 * （函数被 new 调用时返回对象即为构造结果）
 */
export function I18nAutoRspackPlugin(options?: Options) {
  return I18nAuto.rspack(options)
}

export default I18nAutoRspackPlugin
