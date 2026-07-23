import { LanguagesMapById, LanguagesMapByLocale, LngType } from './types/index'
export type * from './types/index'

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
   * 扩展语言包数据(仅接收 by-locale 格式:{ lng: { id: text } })
   * @param lngMap by-locale 语言包数据
   * @param cover 是否覆盖
   *
   * 磁盘单文件为 by-id(便于人工横向校对各语种译文),由注册文件通过
   * toByLocale 转置为 by-locale 后再注入;此处不再猜测格式,故不依赖 lngList。
   */
  extendLocale(lngMap: LanguagesMapByLocale, cover: boolean = false) {
    if (!isObj(lngMap)) return

    for (let lng in lngMap) {
      const item = lngMap[lng] || {}
      if (!isObj(item)) continue
      if (!this._locales[lng]) this._locales[lng] = {}
      for (let id in item) {
        const oldValue = this._locales[lng][id] || item[id]
        this._locales[lng][id] = cover ? item[id] : oldValue
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

/**
 * by-id 转 by-locale 纯转置:{ id: { lng: text } } -> { lng: { id: text } }
 *
 * 不依赖语种列表,纯结构操作。磁盘单文件存 by-id(便于人工校对各语种译文),
 * 注册文件转成 by-locale 后注入运行时,使 extendLocale 不必猜测格式。
 */
export const toByLocale = (
  byId: LanguagesMapById,
): LanguagesMapByLocale => {
  const byLocale: LanguagesMapByLocale = {}
  for (const id in byId) {
    const item = byId[id]
    if (!isObj(item)) continue
    for (const lng in item) {
      const v = item[lng as LngType]
      if (v == null) continue
      const slot = byLocale[lng as LngType] || (byLocale[lng as LngType] = {})
      slot[id] = v
    }
  }
  return byLocale
}
