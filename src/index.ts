import { LanguagesMap, LanguagesMapByLocale, LngType } from './types/index'
export type * from './types/index'

const lngList: LngType[] = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'zh-TW']

const isObj = (obj: any) => typeof obj === 'object' && obj !== null

// SSR/Node/小程序等无 window 环境守卫：
// window?.xxx 不能保护未声明的全局标识符，必须用 typeof 判断
const isBrowser = typeof window !== 'undefined'

type TranslateFn<T = any> = (str: T, data?: object) => T

export type I18nManagerOptions = {
  localStorageKey?: string
  currentLng?: LngType
  storage?: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  }
}
export class I18nManager {
  /** 语言映射表 */
  private _locales: LanguagesMapByLocale = {}
  /** 翻译函数缓存 */
  private _cacheFns: { [key in LngType]?: TranslateFn } = {}

  _options: Required<I18nManagerOptions> = {
    currentLng: 'zh-CN',
    storage: isBrowser ? window.localStorage : undefined!,
    localStorageKey: '$w-i18n-auto-locale',
  }

  constructor(options: I18nManagerOptions = {}) {
    this._options = Object.assign(this._options, options)
    this._options.currentLng = this.getCurrentLng()
    this.i18n = this._createTranslator()
  }

  /**
   * 创建翻译函数
   * @param locale 语种名称
   * @returns 翻译函数
   */
  private _createTranslator = (locale?: string): TranslateFn => {
    if (locale && this._cacheFns[locale]) {
      return this._cacheFns[locale]
    }

    const fn = (str: any, ...args: any[]) => {
      if (!str || typeof str !== 'string') return str

      const lng = locale || this.getCurrentLng()
      const value = this._locales[lng]?.[str] || str
      return this._format(value, ...args)
    }
    locale && (this._cacheFns[locale] = fn)

    return fn
  }

  private _format(str: string, data?: object) {
    return str.replace(/(\\)?\{\{([\s\S]+?)\}\}/g, (_, escape, key) => {
      if (escape) return _.substring(1)
      // data 中缺失的 key 保留原占位符,避免输出字面量 "undefined"
      const val = (data || {})[key]
      return val === undefined ? `{{${key}}}` : String(val)
    })
  }

  i18n: TranslateFn = this._createTranslator()

  /**
   * 扩展语言包数据
   * @param config 语言包数据
   * @param cover 是否覆盖
   */
  extendLocale(lngMap: LanguagesMap, cover: boolean = false) {
    if (!isObj(lngMap)) return

    for (let _key in lngMap) {
      const key = _key as LngType
      const item = lngMap[key] || {}
      if (!isObj(item)) continue

      // 语言列表中的键值，直接合并
      if (lngList.includes(key)) {
        if (!this._locales[key]) this._locales[key] = {}
        for (let id in item) {
          const oldValue = this._locales[key][id] || item[id]
          this._locales[key][id] = cover ? item[id] : oldValue
        }
      }
      // 非语言列表中的键值，默认添加到所有语言包中
      else {
        for (let lng in item) {
          if (!this._locales[lng]) this._locales[lng] = {}
          const oldValue = this._locales[lng][key] || item[lng]
          this._locales[lng][key] = cover ? item[lng] : oldValue
        }
      }
    }
  }

  /**
   * 删除语言包数据
   * @param name 语种名称
   * @param {string[] | string} keys 键值
   */
  removeLocale(name: LngType, keys: Array<string> | string) {
    if (!keys) return
    if (!Array.isArray(keys)) keys = [keys]
    keys.forEach((key) => {
      if (this._locales?.[name]?.[key]) {
        delete this._locales[name][key]
      }
    })
  }

  /**
   * 获取当前语种
   * @returns 当前语种
   */
  getCurrentLng(): LngType {
    const { storage, localStorageKey, currentLng } = this._options
    const storeLng = storage?.getItem(localStorageKey!) as LngType
    return storeLng || currentLng || 'zh-CN'
  }

  changeLanguage(lng: LngType, autoLoad: boolean = true) {
    this._options.currentLng = lng
    const { localStorageKey, storage } = this._options
    storage?.setItem(localStorageKey, lng)
    this.i18n = this._createTranslator(lng)
    i18n = this.i18n.bind(this)
    if (autoLoad && isBrowser) window.location.reload()
  }
}

export const i18nManager = new I18nManager()
export let i18n = i18nManager.i18n.bind(i18nManager)
export const extendLocale = i18nManager.extendLocale.bind(i18nManager)
export const removeLocale = i18nManager.removeLocale.bind(i18nManager)
export const getCurrentLng = i18nManager.getCurrentLng.bind(i18nManager)
export const changeLanguage = i18nManager.changeLanguage.bind(i18nManager)
