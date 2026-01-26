import { LngType } from './types/index'

export type * from './types/index'

type TranslateFn<T = any> = (str: T, data?: object) => T

let defaultLocale: LngType = 'zh-CN'
let localStorageKey = '$w-i18n-auto-locale'
let cacheFns: { [key: string]: TranslateFn } = {}
// @ts-ignore
let locales: Record<LngType, Record<string, string>> = {}

function format(str: string, data?: object) {
  return str.replace(/(\\)?\{\{([\s\S]+?)\}\}/g, (_, escape, key) => {
    if (escape) return _.substring(1)
    return (data || {})[key]
  })
}

const makeTranslator = (locale?: string): TranslateFn => {
  if (locale && cacheFns[locale]) return cacheFns[locale]
  const fn = (str: any, ...args: any[]) => {
    if (!str || typeof str !== 'string') return str
    const value =
      locales[locale!]?.[str] ||
      locales[defaultLocale]?.[str] ||
      locales['zh-CN']?.[str] ||
      str
    return format(value, ...args)
  }
  locale && (cacheFns[locale] = fn)
  return fn
}

/**
 * 扩展语言包数据
 * @param {LngType} name 语种名称
 * @param {object} config 语言包数据
 * @param {boolean} cover 是否覆盖
 */
function extendLocale(
  name: LngType,
  config: Record<string, string>,
  cover: boolean = true,
) {
  if (cover) {
    // 覆盖式扩展语料
    locales[name] = {
      ...(locales[name] || {}),
      ...config,
    }
  } else {
    locales[name] = {
      ...config,
      ...(locales[name] || {}),
    }
  }
}

/**
 * 删除语言包数据
 * @param name 语种名称
 * @param {string[] | string} key 键值
 */
function removeLocaleData(name: LngType, key: Array<string> | string) {
  if (Array.isArray(key)) {
    key.forEach((item) => {
      removeLocaleData(name, item)
    })
    return
  }
  if (locales?.[name]?.[key]) {
    delete locales[name][key]
  }
}

let _defaultLocale: LngType = defaultLocale
if (typeof localStorage !== 'undefined') {
  let locale = localStorage.getItem(localStorageKey) as LngType
  _defaultLocale = locale || defaultLocale
}
/**
 * 翻译函数
 */
let i18n = makeTranslator(_defaultLocale)
/**
 * 切换语言
 * @param {LngType} locale 语言类型
 */
function changeLanguage(locale: LngType, autoReload: boolean = true) {
  i18n = makeTranslator(locale)
  localStorage.setItem(localStorageKey, locale)
  if (autoReload) location.reload()
}
/**
 * 返回当前语言
 * @returns {LngType}
 */
function currentLanguage(): LngType {
  return (localStorage.getItem(localStorageKey) || defaultLocale) as LngType
}

export {
  i18n,
  changeLanguage,
  currentLanguage,
  extendLocale,
  removeLocaleData,
  localStorageKey,
}
