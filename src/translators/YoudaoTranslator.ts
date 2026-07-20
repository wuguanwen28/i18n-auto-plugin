import chalk from 'chalk'
import crypto from 'node:crypto'
import {
  LngType,
  TranslateParams,
  TranslateServiceConfig,
  TranslatorOptions,
} from '../types'
import { Translator } from './Translator'

export class YoudaoTranslator extends Translator {
  name = '有道翻译'
  url = 'https://openapi.youdao.com/v2/api'

  serverConfig!: TranslateServiceConfig

  // 有道语种代码:简体为 zh-CHS(注意不是 zh-CN),繁体 zh-CHT
  lngTypeMap: Record<LngType, string> = {
    'zh-CN': 'zh-CHS',
    'zh-TW': 'zh-CHT',
    'en-US': 'en',
    'ja-JP': 'ja',
    'ko-KR': 'ko',
  }

  constructor(options: TranslatorOptions) {
    super(options)
    const { translateService, youdao } = options.config || {}
    // translateService 已归一化为数组,包含本服务即认领配置
    if (translateService.includes('youdao')) {
      if (!youdao?.appId || !youdao?.appKey) {
        throw new Error(`请配置${this.name}的appId和appKey`)
      }
      this.serverConfig = youdao
    }
  }

  async requestTranslate(
    texts: TranslateParams = {},
    fromLang: LngType,
    toLang: LngType,
  ): Promise<TranslateParams> {
    const res = await this.handleFetch(texts, fromLang, toLang)
    const { errorCode, translateResults = [], errorIndex = [] } = res || {}

    // errorCode 为 0(或 "0")表示成功;非 0 视为整体失败
    // (部分条目失败由 errorIndex 标记,不在此处理)
    const code = Number(errorCode)
    if (code !== 0) {
      type CodeMap = keyof typeof this.errorCodeMap
      const errorInfo = this.errorCodeMap[code as CodeMap]
      const [msg = `错误码 ${errorCode}`, tip] = errorInfo || []
      const tipStr = tip ? `\n${chalk.bold.yellow('Tip:')} ${tip}` : ''
      throw new Error(`${this.name}错误：${msg}${tipStr}`)
    }

    // query -> 译文 映射(同一原文可能对应多个 id)
    const queryToTranslation: Record<string, string> = {}
    for (const item of translateResults) {
      if (item.query && item.translation) {
        queryToTranslation[item.query] = item.translation
      }
    }

    // errorIndex 标记的是返回结果中失败的序号(从 0 开始,对应 q 的顺序)
    const failedIndexSet = new Set(errorIndex as number[])

    // 按调用时 q 的顺序还原 id -> 译文
    const ids = Object.keys(texts)
    const result: TranslateParams = {}
    ids.forEach((id, index) => {
      if (failedIndexSet.has(index)) return
      const translation = queryToTranslation[texts[id]]
      if (translation) result[id] = translation
    })

    return result
  }

  async handleFetch(
    texts: TranslateParams,
    fromLang: LngType,
    toLang: LngType,
  ) {
    const { appId, appKey } = this.serverConfig
    const from = this.lngTypeMap[fromLang] || 'auto'
    const to = this.lngTypeMap[toLang] || 'en'

    // 文本数组:多 q 字段方式提交,与返回 translateResults 一一对应
    const qList = Object.values(texts)
    // input 计算:把所有 q 拼接成一个字符串(有道官方 demo 做法)
    const joinedQ = qList.join('')
    const input =
      joinedQ.length > 20
        ? joinedQ.slice(0, 10) + joinedQ.length + joinedQ.slice(-10)
        : joinedQ

    const salt = crypto.randomUUID()
    const curtime = Math.floor(Date.now() / 1000).toString()
    const sign = crypto
      .createHash('sha256')
      .update(appId + input + salt + curtime + appKey)
      .digest('hex')

    const body = new URLSearchParams()
    body.append('from', from)
    body.append('to', to)
    body.append('appKey', appId)
    body.append('salt', salt)
    body.append('sign', sign)
    body.append('signType', 'v3')
    body.append('curtime', curtime)
    qList.forEach((q) => body.append('q', q))

    return await fetch(this.url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then((res) => res.json())
  }

  errorCodeMap = {
    101: ['缺少必填参数', '确认参数齐全且书写正确'],
    102: ['不支持的语言类型', '检查 from/to 是否在语种列表中'],
    103: ['翻译文本过长', '减小单次 q 的长度(单次最大 5000 字符)'],
    108: ['应用ID无效', '登录后台创建应用和实例并完成绑定'],
    110: ['无相关服务的有效实例', '应用未绑定服务,请在控制台新建并绑定服务'],
    111: ['开发者账号无效', '检查账号状态'],
    112: ['请求服务无效', '检查服务配置'],
    113: ['q不能为空', '检查待翻译文本'],
    202: [
      '签名检验失败',
      '确认 appKey/appId 正确,且 q 为 UTF-8 编码;仍失败一般是编码问题',
    ],
    203: ['访问IP不在可访问IP列表', '检查后台配置的服务器IP'],
    206: ['时间戳无效导致签名校验失败', '检查系统时间是否准确'],
    207: ['重放请求', 'salt 需保证唯一(已用 UUID),同一请求不可重复提交'],
    302: ['翻译查询失败', '请重试'],
    304: ['翻译失败', '请联系技术支持'],
    401: ['账户已欠费', '请进行账户充值'],
  }
}
