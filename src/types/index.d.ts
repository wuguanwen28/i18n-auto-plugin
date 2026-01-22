import { Translator } from '../translators/Translator'

export type InitConfigOptions = {
  /**
   * 是否强制覆盖
   */
  force?: boolean
  /**
   * 配置文件路径
   */
  config?: string
}

export type TranslateOptions = {
  /**
   * 配置文件路径
   */
  config?: string
}

export type LoggerLevel = 'error' | 'warn' | 'info' | 'none'

export type LngType = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'zh-TW'

export type LanguagesMap = {
  [id: string]: { [key in LngType]?: string }
}

export type TranslateParams = { [id: string]: string }

export type TranslateServiceType =
  | 'google'
  | 'baidu'
  | 'baiduAi'
  | 'youdao'
  | 'custom'

export type TranslateServiceConfig = {
  /**
   * 你申请的 appId
   */
  appId: string
  /**
   * 你申请的 appKey
   */
  appKey: string
}

export interface I18nConfig {
  /**
   * 入口文件夹路径
   */
  entry: string | string[]
  /**
   * 出口路径
   */
  output: {
    /**
     * 输出目录
     * @default './src/locale'
     */
    dir?: string
    /**
     * 输出文件名
     * 当 splitLngFile 为 true 时, [name]为语种名称
     * @default "index.json" | "[name].json"
     */
    file?: string
    /**
     * 是否将不同语种的翻译分别存储到不同的文件中
     * @default false
     */
    splitLngFile?: boolean
  }
  /**
   * 是否开启缓存，如文件没有变化，不会重复解析
   * @default true
   */
  cache?: boolean

  /**
   * 日志级别
   * @default 'info'
   */
  logger?: LoggerLevel
  /**
   * 查找文件规则
   * @default /.*(js|jsx|ts|tsx|vue)$/
   */
  test?: RegExp | string
  /**
   * 包含的文件或文件夹
   */
  include?: string | Array<string>
  /**
   * 排除的文件夹或文件，优先级高于include
   * @default ["node_modules"]
   */
  exclude?: string | Array<string>
  /**
   * 标记不会被翻译的函数调用列表
   * 如：console.log('xxx')
   */
  excludeCall?: Array<string>
  /**
   * 原始语种
   * tip: 暂只支持中文
   */
  originLang?: 'zh-CN'
  /**
   * 要翻译的语种
   */
  languages?: LngType[]
  /**
   * 翻译服务
   */
  translateService: TranslateServiceType
  /**
   * 百度通用文本翻译配置
   */
  baidu?: TranslateServiceConfig
  /**
   * 百度大模型文本翻译配置
   */
  baiduAi?: TranslateServiceConfig
  /**
   * 有道翻译配置
   */
  youdao?: TranslateServiceConfig

  /**
   * 自定义翻译器
   *
   */
  CustomTranslate?: Translator
}

export type Configuration = Omit<
  Required<I18nConfig>,
  'include' | 'exclude' | 'test'
> & {
  test: RegExp
  include: string[]
  exclude: string[]
  __rootPath: string
}
