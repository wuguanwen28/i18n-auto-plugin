// @ts-ignore
import { PluginOptions } from 'vite'

import { InitConfig } from '../commands/InitConfig'
export function i18nAutoPlugin(): PluginOptions {
  console.log('config ==> ', new InitConfig({}))
  return {
    name: 'vite-plugin-i18n-auto',
    enforce: 'pre',
    transform: function (code: string, file: string) {},
  }
}
