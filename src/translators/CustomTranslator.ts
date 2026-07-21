import { LngType, TranslateParams, TranslatorOptions } from '../types'
import { Translator } from './Translator'

export class CustomTranslator extends Translator {
  name = '自定义翻译'

  constructor(options: TranslatorOptions) {
    super(options)
  }

  async requestTranslate(
    texts: TranslateParams,
    fromLang: LngType,
    toLang: LngType,
  ): Promise<TranslateParams> {
    const { CustomTranslate } = this.config
    if (typeof CustomTranslate !== 'function') {
      throw new Error(
        `请配置 CustomTranslate 翻译函数: (texts, fromLang, toLang) => Promise<TranslateParams>`,
      )
    }
    // 委托用户自定义函数:入参 {id: 原文},返回 {id: 译文},key 需一一对应
    return await CustomTranslate(texts, fromLang, toLang)
  }
}
