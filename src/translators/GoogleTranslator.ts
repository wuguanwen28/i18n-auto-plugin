import { Configuration, LanguagesMap, LngType, TranslateParams } from '../types'
import { Translator } from './Translator'

export class GoogleTranslator extends Translator {
  constructor(options: {
    languagesMap: LanguagesMap
    config: Configuration
    writeLanguagesMap: () => void
  }) {
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
