import { BaiduTranslator } from './BaiduTranslator'
import { BaiduAiTranslator } from './BaiduAiTranslator'
import { GoogleTranslator } from './GoogleTranslator'
import { YoudaoTranslator } from './YoudaoTranslator'
import { CustomTranslator } from './CustomTranslator'

export default {
  baidu: BaiduTranslator,
  google: GoogleTranslator,
  baiduAi: BaiduAiTranslator,
  youdao: YoudaoTranslator,
  custom: CustomTranslator,
}

export {
  GoogleTranslator,
  YoudaoTranslator,
  BaiduTranslator,
  BaiduAiTranslator,
}
