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
import { capitalizeFirst, shouldCapitalize } from '../utils/capitalize'
import { logger } from '../utils/logger'

export abstract class Translator {
  config: Configuration
  languagesMap: LanguagesMapById

  /** 多服务模式下,各服务对应的翻译器实例(由 Translate.translate 注入) */
  serviceTranslators?: Partial<Record<TranslateServiceType, Translator>>

  /**
   * 服务族:用于 langMap 按族查表。子类设置(baidu/baiduAi='baidu',
   * youdao/youdaoAi='youdao',google='google')。Custom 不设(不经过 resolveLngCode)
   */
  serviceGroup?: string

  /**
   * 项目语种 -> 本服务 API 语种代码(内置常用语种映射)
   * 自定义语种不在内,走 config.langMap;resolveLngCode 统一查表
   */
  lngTypeMap: Record<string, string> = {}

  /**
   * 校验本服务配置是否齐全(各子类实现)
   * 供 validateTranslateServices 启动校验与构造函数认领配置共用,避免判断逻辑重复
   */
  static hasConfig(_config: Configuration): boolean {
    return false
  }

  constructor(options: TranslatorOptions) {
    this.config = options.config
    this.languagesMap = options.languagesMap
  }

  /**
   * 解析语种到本服务的 API 代码
   * 查表顺序:config.langMap[语种][服务族] -> 内置 lngTypeMap[语种]
   * 都没有则报错中断(避免自定义语种静默兜底成 en 而翻错)
   */
  protected resolveLngCode(lng: string): string {
    const group = this.serviceGroup
    const code =
      (group && this.config.langMap?.[lng]?.[group]) || this.lngTypeMap[lng]
    if (!code) {
      logger.error(
        `语种 ${chalk.bold(lng)} 在 ${group || this.constructor.name} 翻译服务无映射,` +
          `请在配置 langMap 中补充,例如:langMap: { '${lng}': { ${group || 'baidu'}: '对应API代码' } }`,
      )
      process.exit(0)
    }
    return code
  }

  /**
   * 运行翻译:按服务数量分流
   * 单服务(length<=1)走 runSingle,多服务(校验模式)走 runMulti
   * @param callback 每翻译完一个语种后的回调函数
   */
  async run(
    callback?: (langMap: LngType) => void | Promise<any>,
  ): Promise<LanguagesMapById> {
    const { translateService } = this.config
    if (translateService.length > 1) {
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
          await this.waitQps()
          let result = await this.withRetry(() =>
            this.requestTranslate(langMap, originLang, toLang),
          )
          for (const id in langMap) {
            if (!result[id]) {
              logger.warn(`翻译失败：${langMap[id]}`)
              continue
            }
            this.languagesMap[id] ||= {}
            this.languagesMap[id][toLang] = await this.postProcess(
              this.reFormatText(result[id]),
              {
                id,
                fromLang: originLang,
                toLang,
                origin: this.languagesMap[id]?.[originLang] ?? '',
              },
            )

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
    const services = translateService
    const primaryService = services[0]
    // emitDiff 未显式配置时,默认翻译服务 > 2 个才生成(此时多数一致判断才有意义)
    const emitDiff = this.config.output.emitDiff ?? translateService.length > 2
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
            await this.waitQps()
            const res = await this.withRetry(
              () =>
                this.requestTranslateByService(svc, langMap, originLang, toLang),
              svc,
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
            this.languagesMap[id][toLang] = await this.postProcess(
              this.reFormatText(suggested),
              {
                id,
                fromLang: originLang,
                toLang,
                origin: this.languagesMap[id]?.[originLang] ?? '',
              },
            )
            logger.info(
              `翻译成功：${sliceText(langMap[id])} -> ${sliceText(suggested)}`,
            )
          } else {
            logger.warn(`所有服务翻译失败：${langMap[id]}`)
          }

          // 差异条目进报告(consensus: true 的不进);emitDiff 关闭时跳过收集
          if (emitDiff && !consensus) {
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

    // 写差异报告(emitDiff 关闭时跳过)
    if (emitDiff) {
      await writeDiffReport(this.config, diffReport, this.languagesMap)
    }

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

  private lastRequestTime = 0

  /** QPS 限流:确保请求间隔不小于 1000/qps ms(qps<=0 不限) */
  private async waitQps() {
    const { qps } = this.config
    if (!qps || qps <= 0) return
    const minInterval = 1000 / qps
    const elapsed = Date.now() - this.lastRequestTime
    if (elapsed < minInterval) {
      await new Promise((r) => setTimeout(r, minInterval - elapsed))
    }
    this.lastRequestTime = Date.now()
  }

  /** 包装翻译调用,失败重试(指数退避 1s/2s/4s) */
  private async withRetry<T>(fn: () => Promise<T>, label = '翻译'): Promise<T> {
    const retries = this.config.retryTimes ?? 3
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        if (attempt >= retries) throw error
        const delay = 1000 * 2 ** (attempt - 1)
        logger.warn(
          `${label}失败(${attempt}/${retries}),${delay}ms 后重试: ${(error as Error).message}`,
        )
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    throw new Error('unreachable')
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
      // 跳过已翻译的(forceTranslate 时重译)
      if (!this.config.forceTranslate && item[toLang]) continue

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

  /**
   * 译文后处理:capitalize 内置规则 + formatTranslatedText 用户钩子
   * 在 reFormatText 之后调用,返回最终落盘文本
   * 顺序:reFormatText -> capitalize(语种匹配时) -> formatTranslatedText(可覆盖)
   */
  protected async postProcess(
    text: string,
    ctx: { id: string; fromLang: LngType; toLang: LngType; origin: string },
  ): Promise<string> {
    let result = text
    if (shouldCapitalize(this.config.capitalize, ctx.toLang)) {
      result = capitalizeFirst(result)
    }
    const hook = this.config.formatTranslatedText
    if (typeof hook === 'function') {
      const hooked = await hook(result, ctx)
      // 返回非空字符串才覆盖,空串/undefined/void 时保留当前译文,避免误落空
      if (typeof hooked === 'string' && hooked) result = hooked
    }
    return result
  }

  abstract requestTranslate(
    texts: TranslateParams,
    fromLang: LngType,
    toLang: LngType,
  ): Promise<TranslateParams>
}
