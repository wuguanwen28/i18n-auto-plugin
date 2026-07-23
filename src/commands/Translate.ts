import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'

import {
  getHash,
  replaceTemplateExpr,
  scanFile,
  time,
} from '../utils'
import translatorMap, { BaiduTranslator } from '../translators'
import type { Translator } from '../translators/Translator'
import {
  Configuration,
  LanguagesMapById,
  TranslateOptions,
  TranslateServiceType,
} from '../types'
import { DEFAULT_EXCLUDE_CALL } from '../utils/config'
import { logger } from '../utils/logger'
import { cacheManager } from '../utils/cache'
import { isAllowTranslate, parseAst, resolveTraverse } from '../utils/parse'
import { extractVueSfc } from '../plugins/vue-sfc'
import { generateRegisterFile } from './RegisterFile'
import { LocaleCommand } from './LocaleCommand'

const traverse = resolveTraverse()

export class Translate extends LocaleCommand {
  /** CLI scan 命令:只扫描写语料,跳过翻译 */
  skipTranslate?: boolean

  /** CLI --force:强制重新翻译,覆盖配置中的 forceTranslate */
  cliForceTranslate?: boolean

  count = 0

  constructor(options: TranslateOptions = {}) {
    super(options)
    this.skipTranslate = options.skipTranslate
    this.cliForceTranslate = options.force
  }

  async run() {
    try {
      const log = logger.info
      const startTime = Date.now()
      await time('初始化配置', () => this.initConfig(), log)
      await time('获取旧的语料', () => this.getOldLanguagesMap(), log)
      await time('扫描新的语料', () => this.getNewLanguagesMap(), log)
      await time('写入新语料', () => this.writeLanguagesMap(), log)
      // scan 命令或 skipTranslate 时跳过翻译,只更新语料文件
      if (!this.skipTranslate) {
        await time('翻译语料', () => this.translate(), log)
        await time('生成注册文件', () => generateRegisterFile(this.config, this.outputMap), log)
      }
      const totalTime = Date.now() - startTime
      const label = this.skipTranslate ? '扫描完成' : '翻译完成'
      logger.info(chalk.green.bold(`[${label}] 总耗时：${totalTime}ms`))
    } catch (error) {
      logger.error(error as Error)
    }
  }

  async initConfig() {
    await super.initConfig()
    // --force 覆盖配置中的 forceTranslate
    if (this.cliForceTranslate) this.config.forceTranslate = true
  }

  /** 获取新的语言映射 */
  async getNewLanguagesMap() {
    const __rootPath = this.config.__rootPath
    this.config.entry.forEach((p) => {
      const dirPath = path.resolve(__rootPath, p)
      scanFile(dirPath, this.config, (p) => this.scanTargetLang(p))
    })
  }

  /** 扫描文件中的目标语言 */
  scanTargetLang(filePath: string) {
    let languagesMap: LanguagesMapById | null = null
    if (this.config.cache) languagesMap = cacheManager.getCache(filePath, this.config)

    if (!languagesMap) {
      logger.info(`发现文件(${++this.count}): ${filePath}`)

      let { excludeCall = [] } = this.config || {}
      excludeCall = [...excludeCall, ...DEFAULT_EXCLUDE_CALL]

      let result: LanguagesMapById = {}
      const addText = (text: string) => {
        const id = getHash(text)
        result[id] = result[id] || {}
        result[id]['zh-CN'] = text
      }

      const scanScript = (code: string) => {
        const ast = parseAst(filePath, code)
        if (!ast) return
        traverse(ast, {
          // jsx文本：<div>花飘万家雪</div>
          JSXText(path) {
            if (!isAllowTranslate(path, excludeCall)) return
            const text = path.toString().trim()
            addText(text)
          },
          // 普通文本：'花飘万家雪'
          StringLiteral(path) {
            if (!isAllowTranslate(path, excludeCall)) return
            const text = path.node.value.toString()
            addText(text)
          },
          // 模板文本：`花飘万家雪${xxx}`
          TemplateLiteral(path) {
            if (!isAllowTranslate(path, excludeCall)) return
            let i = 0
            const text = replaceTemplateExpr(
              path.toString().replace(/^`|`$/g, ''),
              () => `{{@${++i}}}`,
            )
            addText(text)
          },
        })
      }

      // .vue：template 文本走与插件转换共用的 walker（hash 一致），
      // script 块走 babel 扫描
      if (filePath.endsWith('.vue')) {
        if (fs.existsSync(filePath)) {
          const code = fs.readFileSync(filePath, 'utf-8')
          const { texts, scripts } = extractVueSfc(code, filePath)
          texts.forEach(addText)
          scripts.forEach(scanScript)
        }
      } else {
        scanScript(
          fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '',
        )
      }

      languagesMap = result
    }
    if (this.config.cache) {
      cacheManager.setCache(filePath, languagesMap, this.config)
    }

    this.mergeLanguagesMap(languagesMap)
  }

  /** 翻译 */
  async translate() {
    const { translateService } = this.config
    const services = translateService

    // 校验:每个所选服务都要有对应配置
    this.validateTranslateServices(services)

    // 为每个服务创建 Translator 实例,共享同一个 languagesMap
    const serviceTranslators: Partial<
      Record<TranslateServiceType, Translator>
    > = {}
    let primaryTranslator: Translator | null = null
    for (const svc of services) {
      const TranslatorCtor = translatorMap[svc] || BaiduTranslator
      const t = new TranslatorCtor(this)
      serviceTranslators[svc] = t
      if (!primaryTranslator) primaryTranslator = t
    }

    // 把所有服务实例注入主翻译器,runMulti 通过它调用各服务
    primaryTranslator!.serviceTranslators = serviceTranslators
    await primaryTranslator!.run((lng) => {
      this.writeLanguagesMap(lng)
    })
  }

  /** 校验所选服务均已配置,缺失则报错退出 */
  private validateTranslateServices(services: TranslateServiceType[]) {
    const missing: string[] = []
    for (const svc of services) {
      const Ctor = translatorMap[svc] as { hasConfig?: (c: Configuration) => boolean }
      if (!Ctor?.hasConfig?.(this.config)) missing.push(svc)
    }
    if (missing.length) {
      logger.error(
        `translateService 含 ${missing.join(', ')},但未配置对应的密钥,请补全配置`,
      )
      process.exit(0)
    }
  }
}
