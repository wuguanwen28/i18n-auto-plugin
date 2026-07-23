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
  retryTimes: 3,
  qps: 0,
  baidu: {
    appId: '',
    appKey: '',
  },
}

export const ZH_EXT = /[\u4e00-\u9fa5]+/

/**
 * 内置语种列表(与 LngType 内置 16 种保持一致,按百度个人版支持口径)
 * 判别语言包格式/CSV 列名时,getLocaleKeys 会合并本表 + config.languages + originLang,
 * 故自定义语种也能正确识别
 */
export const lngList: LngType[] = [
  'zh-CN', // 中文(简体)
  'zh-TW', // 中文(繁体)
  'en-US', // 英语
  'ja-JP', // 日语
  'ko-KR', // 韩语
  'fr-FR', // 法语
  'de-DE', // 德语
  'es-ES', // 西班牙语
  'ru-RU', // 俄语
  'ar-SA', // 阿拉伯语
  'pt-BR', // 葡萄牙语(巴西)
  'it-IT', // 意大利语
  'th-TH', // 泰语
  'vi-VN', // 越南语
  'nl-NL', // 荷兰语
  'pl-PL', // 波兰语
]
