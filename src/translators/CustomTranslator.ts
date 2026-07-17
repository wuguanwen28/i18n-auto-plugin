import { LngType, TranslateParams, TranslatorOptions } from '../types'
import { Translator } from './Translator'

export class CustomTranslator extends Translator {
  constructor(options: TranslatorOptions) {
    super(options)
  }

  async requestTranslate(
    texts: TranslateParams,
    fromLang: LngType,
    toLang: LngType,
  ): Promise<TranslateParams> {
    return texts
  }
}
