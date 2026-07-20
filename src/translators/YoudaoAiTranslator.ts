import crypto from 'node:crypto'
import {
  LngType,
  TranslateParams,
  YoudaoAiTranslateServiceConfig,
  TranslatorOptions,
} from '../types'
import { logger } from '../utils/logger'
import { YoudaoTranslator } from './YoudaoTranslator'

/** 占位符正则:匹配译文中的 {{@数字}},用于拆分回各条 */
const PLACEHOLDER_RE = /\{\{@(\d+)\}\}/g

export class YoudaoAiTranslator extends YoudaoTranslator {
  name = '有道大模型翻译'
  url = 'https://openapi.youdao.com/proxy/http/llm-trans'

  // @ts-ignore —— 大模型版配置字段更丰富
  declare serverConfig: YoudaoAiTranslateServiceConfig

  constructor(options: TranslatorOptions) {
    super(options)
    const { translateService, youdaoAi } = options.config || {}
    if (translateService === 'youdaoAi') {
      if (!youdaoAi?.appId || !youdaoAi?.appKey) {
        throw new Error(`请配置${this.name}的appId和appKey`)
      }
      this.serverConfig = youdaoAi
    }

    // 大模型版错误码补充(覆盖父类 errorCodeMap 中不存在的)
    Object.assign(this.errorCodeMap, {
      902000: ['大模型翻译调用失败', '请重试,持续失败请联系技术支持'],
    })
  }

  async requestTranslate(
    texts: TranslateParams = {},
    fromLang: LngType,
    toLang: LngType,
  ): Promise<TranslateParams> {
    const ids = Object.keys(texts)
    if (!ids.length) return {}

    // 用占位符把整批原文拼成一段:原文1{{@1}}原文2{{@2}}...
    // 占位符为 ASCII 字符,大模型不会翻译,译文中原样保留,据此拆回各条
    const indexed = ids.map((id, idx) => ({ id, text: texts[id], idx: idx + 1 }))
    const joinedQ = indexed.map((it) => `${it.text}{{@${it.idx}}}`).join('')

    const translation = await this.fetchStream(joinedQ, fromLang, toLang)
    if (!translation) return {}

    // 按占位符拆分译文:第 N 段(占位符 N-1 与 N 之间)对应第 N 条原文
    return this.splitByPlaceholder(translation, indexed)
  }

  /** 按占位符序号拆分译文,还原 id -> 译文 */
  private splitByPlaceholder(
    translation: string,
    indexed: Array<{ id: string; idx: number }>,
  ): TranslateParams {
    const result: TranslateParams = {}
    // 收集所有占位符位置: [{idx, start, end}]
    const marks: Array<{ idx: number; start: number; end: number }> = []
    let m: RegExpExecArray | null
    PLACEHOLDER_RE.lastIndex = 0
    while ((m = PLACEHOLDER_RE.exec(translation)) !== null) {
      marks.push({
        idx: Number(m[1]),
        start: m.index,
        end: m.index + m[0].length,
      })
    }

    // 没有任何占位符:模型未保留占位符,整批判失败
    if (!marks.length) {
      logger.warn('大模型译文未保留占位符,本批翻译失败')
      return {}
    }

    // 译文结构为 译文1{{@1}}译文2{{@2}}...译文N{{@N}}
    // 即译文N 位于占位符 N 之前:译文1 在串首~{{@1}},译文N 在 {{@(N-1)}}~{{@N}}
    for (const it of indexed) {
      const endMark = marks.find((mk) => mk.idx === it.idx)
      if (!endMark) continue // 该序号占位符丢失,跳过(父类会 warn 翻译失败)
      // 起点:上一条占位符的结尾;第1条起点为串首 0
      const prevMark = marks.find((mk) => mk.idx === it.idx - 1)
      const segStart = prevMark ? prevMark.end : 0
      const segEnd = endMark.start
      const seg = translation.slice(segStart, segEnd).trim()
      if (seg) result[it.id] = seg
    }
    return result
  }

  /** 发送单段拼接文本,读取 SSE 流返回完整译文(不沿用父类 handleFetch 签名) */
  private async fetchStream(
    i: string,
    fromLang: LngType,
    toLang: LngType,
  ): Promise<string> {
    const { appId, appKey, handleOption = 0, prompt, vocabId } = this.serverConfig
    const from = this.lngTypeMap[fromLang] || 'auto'
    const to = this.lngTypeMap[toLang] || 'en'

    // input 计算(与普通版一致):i 前10 + 长度 + 后10(>20时)
    const input =
      i.length > 20 ? i.slice(0, 10) + i.length + i.slice(-10) : i

    const salt = crypto.randomUUID()
    const curtime = Math.floor(Date.now() / 1000).toString()
    const sign = crypto
      .createHash('sha256')
      .update(appId + input + salt + curtime + appKey)
      .digest('hex')

    const body = new URLSearchParams()
    body.append('appKey', appId)
    body.append('salt', salt)
    body.append('signType', 'v3')
    body.append('sign', sign)
    body.append('curtime', curtime)
    body.append('i', i)
    body.append('from', from)
    body.append('to', to)
    body.append('streamType', 'full') // 取全量累积,最后一条即完整译文
    body.append('handleOption', String(handleOption))
    if (prompt) body.append('prompt', prompt)
    if (vocabId) body.append('vocabId', vocabId)

    const res = await fetch(this.url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/event-stream',
      },
    })

    if (!res.ok) {
      throw new Error(`${this.name}请求失败,状态码: ${res.status}`)
    }

    // SSE 流式读取:逐行解析,取最后一条 transFull(全量累积)
    return await this.readStream(res)
  }

  /** 读取 SSE 流,返回最后一条 transFull(完整译文) */
  private async readStream(res: Response): Promise<string> {
    const reader = res.body?.getReader()
    if (!reader) throw new Error(`${this.name}响应流不可读`)

    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let lastFull = ''
    let lastError: { code: string; message: string } | null = null

    const handleLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      // SSE 行格式可能是 "data: {...}" 或裸 JSON
      const jsonStr = trimmed.startsWith('data:')
        ? trimmed.slice(5).trim()
        : trimmed
      if (!jsonStr.startsWith('{')) return
      try {
        const msg = JSON.parse(jsonStr)
        if (msg.successful === false || (msg.code && msg.code !== '0')) {
          lastError = { code: String(msg.code), message: String(msg.message) }
          return
        }
        const full = msg.data?.transFull
        if (typeof full === 'string') lastFull = full
      } catch {
        // 非 JSON 行忽略
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // 按换行切分,保留最后不完整的一段在 buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) handleLine(line)
    }
    // 处理 buffer 剩余
    if (buffer.trim()) handleLine(buffer)

    // lastError 在闭包内赋值,TS 控制流无法追踪,显式标注类型避免被 narrow 成 never
    const err = lastError as { code: string; message: string } | null
    if (err) {
      type CodeMap = keyof typeof this.errorCodeMap
      const code = Number(err.code)
      const errorInfo = this.errorCodeMap[code as CodeMap]
      const [msg = err.message, tip] = errorInfo || []
      const tipStr = tip ? `\nTip: ${tip}` : ''
      throw new Error(`${this.name}错误：${msg}${tipStr}`)
    }

    return lastFull
  }
}
