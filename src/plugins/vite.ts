import type { Plugin } from 'vite'
import { I18nAuto, Options } from './unplugin'

export function I18nAutoPlugin(options?: Options): Plugin {
  return I18nAuto.vite(options) as Plugin
}

export default I18nAutoPlugin
