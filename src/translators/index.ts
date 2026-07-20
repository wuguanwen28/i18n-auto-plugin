import { BaiduTranslator } from './BaiduTranslator'
import { BaiduAiTranslator } from './BaiduAiTranslator'
import { GoogleTranslator } from './GoogleTranslator'
import { YoudaoTranslator } from './YoudaoTranslator'
import { YoudaoAiTranslator } from './YoudaoAiTranslator'
import { CustomTranslator } from './CustomTranslator'

export default {
  baidu: BaiduTranslator,
  google: GoogleTranslator,
  baiduAi: BaiduAiTranslator,
  youdao: YoudaoTranslator,
  youdaoAi: YoudaoAiTranslator,
  custom: CustomTranslator,
}

export {
  GoogleTranslator,
  YoudaoTranslator,
  YoudaoAiTranslator,
  BaiduTranslator,
  BaiduAiTranslator,
}
