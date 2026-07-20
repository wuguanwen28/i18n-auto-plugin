import chalk from 'chalk'
import {
  Configuration,
  DiffReport,
  DiffReportItem,
  LanguagesMapById,
  LngType,
  TranslateParams,
  TranslateServiceType,
  TranslatorOptions,
} from '../types'
import { compareTranslations } from '../utils/diffComparator'
import { writeDiffReport } from '../commands/DiffReport'
import { sliceText } from '../utils'
import { logger } from '../utils/logger'

export abstract class Translator {
  config: Configuration
  languagesMap: LanguagesMapById

  /** 多服务模式下,各服务对应的翻译器实例(由 Translate.translate 注入) */
  serviceTranslators?: Partial<Record<TranslateServiceType, Translator>>

  constructor(options: TranslatorOptions) {
    this.config = options.config
    this.languagesMap = options.languagesMap
  }

  /**
   * 运行翻译:按 translateService 是否数组分流
   * @param callback 每翻译完一个语种后的回调函数
   */
  async run(
    callback?: (langMap: LngType) => void | Promise<any>,
  ): Promise<LanguagesMapById> {
    const { translateService } = this.config
    if (Array.isArray(translateService)) {
      return await this.runMulti(callback)
    }
    return await this.runSingle(callback)
  }

  /** 单服务翻译(现有逻辑) */
  async runSingle(
    callback?: (langMap: LngType) => void | Promise<any>,
  ): Promise<LanguagesMapById> {
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

  /**
   * 多服务校验:对每个目标语种,用所有服务并行翻译,比对差异
   * suggested(多数一致/首个)落盘语言包,差异条目写报告
   */
  async runMulti(
    callback?: (langMap: LngType) => void | Promise<any>,
  ): Promise<LanguagesMapById> {
    const { languages, originLang = 'zh-CN', translateService } = this.config
    const services = translateService as TranslateServiceType[]
    const primaryService = services[0]
    const diffReport: DiffReport = {}

    for (const toLang of languages) {
      if (toLang === originLang) continue
      const list = this.splitText(originLang, toLang)
      if (!list.length) {
        await callback?.(toLang)
        continue
      }

      logger.info(
        chalk.green.bold(
          `开始多服务翻译 ${originLang} -> ${toLang}(${services.join(', ')})`,
        ),
      )

      const langDiffItems: DiffReportItem[] = []

      for (const langMap of list) {
        // 各服务分别翻译同一批,收集结果
        const serviceResults: Partial<
          Record<TranslateServiceType, TranslateParams>
        > = {}
        for (const svc of services) {
          try {
            const res = await this.requestTranslateByService(
              svc,
              langMap,
              originLang,
              toLang,
            )
            serviceResults[svc] = res
          } catch (err) {
            logger.warn(`${svc} 翻译失败: ${(err as Error).message}`)
          }
        }

        // 逐条比对
        for (const id in langMap) {
          const translations: Partial<Record<TranslateServiceType, string>> = {}
          for (const svc of services) {
            const res = serviceResults[svc]
            if (res?.[id]) translations[svc] = res[id]
          }
          const { suggested, consensus } = compareTranslations(
            translations,
            primaryService,
          )

          // 落盘语言包(suggested 非空才写)
          if (suggested) {
            this.languagesMap[id] ||= {}
            this.languagesMap[id][toLang] = this.reFormatText(suggested)
            logger.info(
              `翻译成功：${sliceText(langMap[id])} -> ${sliceText(suggested)}`,
            )
          } else {
            logger.warn(`所有服务翻译失败：${langMap[id]}`)
          }

          // 差异条目进报告(consensus: true 的不进)
          if (!consensus) {
            langDiffItems.push({
              text: langMap[id],
              id,
              translations,
              suggested,
              consensus,
            })
          }
        }
      }

      if (langDiffItems.length) diffReport[toLang] = langDiffItems

      await callback?.(toLang)
    }

    // 写差异报告
    await writeDiffReport(this.config, diffReport)

    return this.languagesMap
  }

  /**
   * 按服务名调用对应 Translator 的 requestTranslate
   * 多服务模式下通过 this.serviceTranslators 查找对应实例;单服务兜底走当前实例
   */
  private async requestTranslateByService(
    svc: TranslateServiceType,
    texts: TranslateParams,
    fromLang: LngType,
    toLang: LngType,
  ): Promise<TranslateParams> {
    const translator = this.serviceTranslators?.[svc]
    if (translator) {
      return await translator.requestTranslate(texts, fromLang, toLang)
    }
    return await this.requestTranslate(texts, fromLang, toLang)
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
