import {
  BaiduAiTranslateServiceConfig,
  Configuration,
  LngType,
  TranslateParams,
  TranslatorOptions,
} from '../types'
import { BaiduTranslator } from './BaiduTranslator'

export class BaiduAiTranslator extends BaiduTranslator {
  name = '百度AI翻译'
  url = 'https://fanyi-api.baidu.com/ait/api/aiTextTranslate'

  // @ts-ignore
  declare serverConfig: BaiduAiTranslateServiceConfig

  /** 校验百度大模型翻译配置是否齐全(appKey 或 apiKey 任一即可) */
  static hasConfig(config: Configuration) {
    return !!(
      config.baiduAi?.appId &&
      (config.baiduAi?.appKey || config.baiduAi?.apiKey)
    )
  }

  constructor(options: TranslatorOptions) {
    super(options)
    const { translateService, baiduAi } = options.config || {}
    // translateService 已归一化为数组,包含本服务即认领配置
    if (translateService.includes('baiduAi')) {
      if (!BaiduAiTranslator.hasConfig(options.config)) {
        throw new Error(`请配置${this.name}的appId和appKey或apiKey`)
      }
      this.serverConfig = baiduAi
    }

    Object.assign(this.errorCodeMap, {
      59002: ['翻译指令过长', 'reference参数超过500字符上限'],
      59003: ['请求文本过长', 'q参数超过6000字符上限'],
      59004: ['QPS超限', '当前接口QPS已触及上限'],
      59005: ['tag_handling 参数非法', '确认参数为0或1'],
      59006: ['标签解析失败', '标签未闭合或为空'],
      59007: ['ignore_tags长度超限', '长度上限为20'],
    })
  }

  async handleFetch(
    texts: TranslateParams,
    fromLang: LngType,
    toLang: LngType,
  ) {
    const { appId, apiKey, appKey, ...otherParams } = this.serverConfig

    if (!apiKey) return super.handleFetch(texts, fromLang, toLang)

    return await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...otherParams,
        appid: appId,
        q: Object.values(texts).join('\n'),
        to: this.lngTypeMap[toLang] || 'en',
        from: this.lngTypeMap[fromLang] || 'auto',
      }),
    }).then((res) => res.json())
  }
}
