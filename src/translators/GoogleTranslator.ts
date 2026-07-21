import { ProxyAgent, setGlobalDispatcher } from 'undici'
import {
  GoogleTranslateServiceConfig,
  LngType,
  TranslateParams,
  TranslatorOptions,
} from '../types'
import { Translator } from './Translator'

export class GoogleTranslator extends Translator {
  name = '谷歌翻译'
  url = 'https://translation.googleapis.com/language/translate/v2'

  serverConfig!: GoogleTranslateServiceConfig

  // Google 语种代码:简体 zh-CN、繁体 zh-TW(与项目 LngType 一致,映射最简单)
  lngTypeMap: Record<LngType, string> = {
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    'en-US': 'en',
    'ja-JP': 'ja',
    'ko-KR': 'ko',
  }

  /** 代理是否已设置全局 dispatcher,避免重复设置 */
  private static proxyInitialized = false

  constructor(options: TranslatorOptions) {
    super(options)
    const { translateService, google } = options.config || {}
    // translateService 已归一化为数组,包含本服务即认领配置
    if (translateService.includes('google')) {
      if (!google?.apiKey) {
        throw new Error(`请配置${this.name}的apiKey`)
      }
      this.serverConfig = google
      this.initProxy(google.proxy)
    }
  }

  /** 设置全局代理:配置 proxy 优先,无则读环境变量,都无则直连 */
  private initProxy(configProxy?: string) {
    if (GoogleTranslator.proxyInitialized) return
    const proxy = configProxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    if (proxy) {
      setGlobalDispatcher(new ProxyAgent(proxy))
    }
    GoogleTranslator.proxyInitialized = true
  }

  async requestTranslate(
    texts: TranslateParams = {},
    fromLang: LngType,
    toLang: LngType,
  ): Promise<TranslateParams> {
    const res = await this.handleFetch(texts, fromLang, toLang)
    const { data = {}, error } = res || {}

    if (error) {
      const { code = 0, message = '未知错误' } = error
      const codeNum = Number(code)
      const errorInfo = this.errorCodeMap[codeNum as keyof typeof this.errorCodeMap]
      const [msg = message, tip] = errorInfo || []
      const tipStr = tip ? `\n${tip}` : ''
      throw new Error(`${this.name}错误(${code}):${msg}${tipStr}`)
    }

    const translations = data.translations || []
    const ids = Object.keys(texts)
    const qList = Object.values(texts)
    const result: TranslateParams = {}

    // v2 返回的 translations 与 q 数组顺序一一对应
    translations.forEach((item: { translatedText: string }, index: number) => {
      const id = ids[index]
      if (id && item.translatedText) result[id] = item.translatedText
    })

    // 数量不匹配(理论不会),按 q 顺序兜底校验
    if (translations.length !== qList.length) {
      // 部分缺失,保留已匹配的
    }

    return result
  }

  async handleFetch(
    texts: TranslateParams,
    fromLang: LngType,
    toLang: LngType,
  ) {
    const { apiKey } = this.serverConfig
    const from = this.lngTypeMap[fromLang] || 'auto'
    const to = this.lngTypeMap[toLang] || 'en'
    const q = Object.values(texts)

    const url = `${this.url}?key=${apiKey}`
    let res: any
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q,
          source: from,
          target: to,
          format: 'text',
        }),
      }).then((r) => r.json())
    } catch (err) {
      // 网络层错误(连不上 Google):国内通常是未配置代理
      throw new Error(
        `${this.name}请求失败: ${(err as Error).message}。可能原因:未配置代理(设置 google.proxy 或环境变量 HTTPS_PROXY),或网络不可达`,
      )
    }

    return res
  }

  errorCodeMap = {
    400: ['请求参数错误', '检查语种代码、文本格式是否正确'],
    403: ['权限不足或 API Key 无效', '确认 API Key 正确且已启用 Cloud Translation API'],
    429: ['超出配额或频率限制', '降低调用频率,或在 Google Cloud 控制台申请提额'],
    500: ['服务内部错误', '请重试'],
  }
}
