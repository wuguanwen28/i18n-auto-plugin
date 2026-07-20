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
  /**
   * 是否使用文件缓存(--no-cache 时为 false,覆盖配置中的 cache)
   */
  cache?: boolean
  /**
   * 日志级别(--logger <level>,覆盖配置中的 logger)
   */
  logger?: LoggerLevel
  /**
   * 是否跳过翻译步骤(scan 命令:只扫描写语料,不调翻译服务)
   */
  skipTranslate?: boolean
}

export type LoggerLevel = 'error' | 'warn' | 'info' | 'none'

export type LngType = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'zh-TW'

/**
 * 语言映射表 - 按键
 * @example
 * let map = {
 *   'id1': {
 *     'zh-CN': '你好',
 *     'en-US': 'Hello',
 *   },
 *   'id2': {
 *     'zh-CN': '世界',
 *     'en-US': 'World',
 *   },
 * }
 */
export type LanguagesMapById = {
  [id: string]: { [key in LngType]?: string }
}

/**
 * 语言映射表 - 按语言
 * @example
 * let map = {
 *   'zh-CN': {
 *     'id1': '你好',
 *     'id2': '世界',
 *   },
 *   'en-US': {
 *     'id1': 'Hello',
 *     'id2': 'World',
 *   },
 * }
 */
export type LanguagesMapByLocale = {
  [lng in LngType]?: { [id: string]: string }
}

export type LanguagesMap = LanguagesMapById | LanguagesMapByLocale

export type TranslateParams = { [id: string]: string }

export type TranslatorOptions = {
  languagesMap: LanguagesMapById
  config: Configuration
}

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
   * 继承另一个配置文件（仅支持文件路径，不支持 npm 包名）
   * 相对路径相对于「声明 extends 的配置文件所在目录」解析（与 tsconfig 一致）
   * 注意：entry/output 等相对路径始终相对执行目录解析，与此解析基准不同
   */
  extends?: string
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
     * 语言包输出文件名
     * 当 splitLngFile 为 true 时, [name]为语种名称
     * @default "index.json" | "[name].json"
     */
    lngFile?: string
    /**
     * @deprecated 已更名为 lngFile,旧字段将在后续版本移除
     */
    file?: string
    /**
     * 是否将不同语种的翻译分别存储到不同的文件中
     * @default false
     */
    splitLngFile?: boolean
    /**
     * 是否生成注册文件(import 语言包并调用 extendLocale 的样板代码)
     * - true(默认):生成到 output.dir 下,执行目录有 tsconfig.json 时为 index.ts,否则 index.js
     * - false:不生成
     * - 字符串:自定义文件名,与 lngFile 一致相对 output.dir 解析,如 'register.ts' 或 '../i18n/register.ts'
     *
     * 已有文件包含 [i18n-auto] 标记时每次覆盖重生成;删除标记行即由用户接管:
     * 终端交互环境会询问是否覆盖(默认否),CI 等非交互环境直接跳过
     * @default true
     */
    registerFile?: boolean | string
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
  emitWarn?: boolean
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
  'include' | 'exclude' | 'entry' | 'extends'
> & {
  entry: string[]
  include: string[]
  exclude: string[]
  __rootPath: string
}

export type OutputMap = {
  [key in LngType | 'main']?: string
}
