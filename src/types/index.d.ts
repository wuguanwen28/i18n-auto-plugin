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
   * 你申请的密钥
   */
  appKey: string
}

/** 百度翻译服务配置 */
export type BaiduTranslateServiceConfig = TranslateServiceConfig & {
  /**
   * 是否需要使用自定义术语干预API
   * -仅开通了”我的术语库“用户生效
   * 1-是，0-否
   */
  needIntervene?: 0 | 1
}

/** 百度大模型文本翻译配置 */
export type BaiduAiTranslateServiceConfig = Omit<
  BaiduTranslateServiceConfig,
  'appKey'
> & {
  /**
   * 你申请的 apiKey
   * 大模型翻译接口支持 apiKey 鉴权
   */
  apiKey?: string
  /**
   * 密钥 sign鉴权需要
   * - 使用API Key鉴权时不需要填写appKey
   */
  appKey?: string
  /**
   * 选择翻译模型
   * - llm：大模型翻译（默认值）
   * - nmt：机器翻译
   */
  model_type?: 'llm' | 'nmt'
  /**
   * 自定义翻译指令
   * 可填写对翻译结果的要求，如“使用学术风格来翻译”
   */
  reference?: string
  /**
   * 标签保持功能
   * - 开启后<>尖括号标签会在译文中保留
   * - 1-开，0-关（默认值）；当前仅支持model_type = 'nmt'
   */
  tag_handling?: 0 | 1
  /**
   * 自定义标签间内容不翻译
   * - 可传入最多20个标签，如：[‘name’, ‘address’]
   * - 仅在 model_type = 'nmt'，且 tag_handling = 1 时生效
   */
  ignore_tags?: string[]
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
   * 在语料中未包含中文是否提示
   * @default true
   */
  warn?: boolean
  /**
   * 导入的i18n函数信息
   * import { $imported as $local } from '$source'
   */
  importInfo?: {
    /** 导入的模块名 */
    source?: string
    /** 导入的函数名 */
    imported?: string
    /** 别名 */
    local?: string
  }
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
   * 每次翻译的文本数量
   * @default 100
   */
  batchSize?: number
  /**
   * 翻译服务
   */
  translateService: TranslateServiceType
  /**
   * 百度通用文本翻译配置
   */
  baidu?: BaiduTranslateServiceConfig
  /**
   * 百度大模型文本翻译配置
   */
  baiduAi?: BaiduAiTranslateServiceConfig
  /**
   * 有道翻译配置
   */
  youdao?: TranslateServiceConfig

  /**
   * 自定义翻译器
   *
   */
  CustomTranslate?: (
    /**
     * 要翻译的文本
     * { "id": "文本" }
     */
    texts: TranslateParams,
    fromLang: LngType,
    toLang: LngType,
  ) => Promise<TranslateParams>
}

export type Configuration = Omit<
  Required<I18nConfig>,
  'include' | 'exclude' | 'entry'
> & {
  entry: string[]
  include: string[]
  exclude: string[]
  __rootPath: string
}

export type OutputMap = {
  [key in LngType | 'main']?: string
}
