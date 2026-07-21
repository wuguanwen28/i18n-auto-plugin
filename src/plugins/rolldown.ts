import { I18nAuto, Options } from './unplugin'

export function i18nAutoPlugin(options?: Options) {
  return I18nAuto.rolldown(options)
}

export default i18nAutoPlugin
