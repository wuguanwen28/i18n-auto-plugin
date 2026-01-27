import chalk from 'chalk'
import { Configuration, LanguagesMap, LngType, TranslateParams } from '../types'
import { sliceText } from '../utils'
import { logger } from '../utils/logger'

export abstract class Translator {
  config: Configuration
  languagesMap: LanguagesMap

  constructor(options: { languagesMap: LanguagesMap; config: Configuration }) {
    this.config = options.config
    this.languagesMap = options.languagesMap
  }

  /**
   * 运行翻译
   * @param callback 每翻译完一个语种后的回调函数
   */
  async run(
    callback?: (langMap: LngType) => void | Promise<any>,
  ): Promise<LanguagesMap> {
    const { languages, originLang = 'zh-CN' } = this.config

    for (const toLang of languages) {
      if (toLang === originLang) continue
      // 分批次翻译
      const list = this.splitText(originLang, toLang)

      if (list.length) {
        logger.info(chalk.green.bold(`开始翻译 ${originLang} -> ${toLang}`))
        for (const langMap of list) {
          let result = await this.requestTranslate(langMap, originLang, toLang)
          for (const id in langMap) {
            if (!result[id]) {
              logger.warn(`翻译失败：${langMap[id]}`)
              continue
            }
            this.languagesMap[id] ||= {}
            this.languagesMap[id][toLang] = this.reFormatText(result[id])

            const f = sliceText(langMap[id])
            const t = sliceText(result[id])
            logger.info(`翻译成功：${f} -> ${t}`)
          }
        }
      }

      await callback?.(toLang)
    }

    return this.languagesMap
  }

  splitText(fromLang: LngType, toLang: LngType) {
    const result: Array<{ [id: string]: string }> = []
    const { batchSize = 100 } = this.config

    let count = 0
    let langMap = {}
    for (const id in this.languagesMap) {
      let item = this.languagesMap[id]
      // 跳过空白原文
      if (!item?.[fromLang]) continue
      // 跳过已翻译的
      if (item[toLang]) continue

      count++
      langMap[id] = this.formatText(item[fromLang])
      if (count >= batchSize) {
        result.push(langMap)
        langMap = {}
        count = 0
      }
    }

    if (count) result.push(langMap)

    return result
  }

  /**
   * 格式化文本，暂时将换行符替换为✅✅
   * TODO优化：有换行符的可以单独翻译再拼接
   */
  formatText(text: string) {
    return text.replace(/\n/g, '✅✅').trim()
  }

  reFormatText(text: string) {
    return text
      .replace(/✅✅/g, '\n')
      .replace(/{{\@\s*([0-9]+)}}/g, (_$1, $2) => `{{@${$2}}}`)
  }

  abstract requestTranslate(
    texts: TranslateParams,
    fromLang: LngType,
    toLang: LngType,
  ): Promise<TranslateParams>
}
