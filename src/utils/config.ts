import { I18nConfig, LngType } from '../types'

export const DEFAULT_EXCLUDE_CALL = [
  'i18n',
  'console.log',
  '_createCommentVNode',
]

export const DEFAULT_CONFIG_PATH = 'i18n.config.js'

export const DEFAULT_CONFIG: I18nConfig = {
  cache: true,
  emitWarn: true,
  logger: 'info',
  entry: './src',
  output: {
    dir: './src/locale',
    lngFile: 'index.json',
    registerFile: true,
    splitLngFile: false,
  },
  importInfo: {
    source: __NAME__,
    imported: 'i18n',
    local: '_i18n',
  },
  test: '.*(js|jsx|ts|tsx|vue)$',
  include: ['src'],
  exclude: ['node_modules'],
  excludeCall: ['i18n', 'console.log', 'console.warn', 'console.error'],
  originLang: 'zh-CN',
  languages: ['en-US'],
  translateService: 'baidu',
  batchSize: 100,
  baidu: {
    appId: '',
    appKey: '',
  },
}

export const ZH_EXT = /[\u4e00-\u9fa5]+/

export const lngList: LngType[] = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'zh-TW']
