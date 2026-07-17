import { I18nAuto, Options } from './unplugin'

/**
 * 兼容 `new I18nAutoWebpackPlugin()` 与 `I18nAutoWebpackPlugin()` 两种调用方式
 * （函数被 new 调用时返回对象即为构造结果）
 */
function I18nAutoWebpackPlugin(options?: Options) {
  return I18nAuto.webpack(options)
}

export default I18nAutoWebpackPlugin
