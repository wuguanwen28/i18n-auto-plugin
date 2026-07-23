import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'

import {
  getConfiguration,
  getExportPrefix,
  getOutputMap,
  mkdirSync,
  prettierCode,
  resolveFile,
} from '../utils'
import {
  Configuration,
  LanguagesMap,
  LanguagesMapById,
  LngType,
  LoggerLevel,
  OutputMap,
  TranslateOptions,
} from '../types'
import { DEFAULT_CONFIG, lngList } from '../utils/config'
import { logger } from '../utils/logger'

/**
 * 语言包命令基类:承载所有 CLI 命令共享的基础设施——配置加载与语言包读写,
 * 不含任何「翻译」能力。
 *
 * Translate(扫描 + 翻译)、Apply(应用 diff)、Check(体检)等命令各取所需:
 * 翻译是 Translate 的专属职责,不应被 Apply/Check 通过继承被动携带。
 */
export abstract class LocaleCommand {
  customConfigPath?: string

  /** CLI --no-cache 时为 false,覆盖配置中的 cache */
  cliCache?: boolean

  /** CLI --logger,覆盖配置中的 logger */
  cliLogger?: LoggerLevel

  config!: Configuration

  outputMap: OutputMap = {}

  languagesMap: LanguagesMapById = {}

  constructor(options: TranslateOptions = {}) {
    this.customConfigPath = options.config
    this.cliCache = options.cache
    this.cliLogger = options.logger
  }

  async initConfig() {
    const config = await getConfiguration(this.customConfigPath)
    if (!config) {
      logger.error(
        `配置文件不存在，请执行 ${chalk.bold.green('npx i18n init')} 初始化`,
      )
      process.exit(0)
    }
    this.config = { ...DEFAULT_CONFIG, ...config }
    // cac 声明 --no-cache 后未传参也会得到 cache: true,
    // 因此仅在显式传入 --no-cache(false)时覆盖配置
    if (this.cliCache === false) this.config.cache = false
    // --logger 覆盖配置中的日志级别
    if (this.cliLogger) this.config.logger = this.cliLogger
    this.outputMap = getOutputMap(this.config)
    logger.setLogLevel(this.config.logger)
  }

  /** 获取旧的语言映射 */
  async getOldLanguagesMap() {
    const outputMap = this.outputMap
    const mainPath = outputMap.main
    if (mainPath && fs.existsSync(mainPath)) {
      const content = await resolveFile(mainPath)
      this.languagesMap = content || {}
    } else {
      for (const lng in outputMap) {
        const filePath = outputMap[lng]
        if (filePath && fs.existsSync(filePath)) {
          const content = await resolveFile(filePath)
          this.mergeLanguagesMap({ [lng]: content })
        }
      }
    }
  }

  /** 写入语言映射 */
  async writeLanguagesMap(targetLng?: LngType) {
    const outputMap = this.outputMap
    const { splitLngFile } = this.config.output

    const writeFile = async (filepath: string, code: string) => {
      mkdirSync(path.dirname(filepath))
      const finalCode = getExportPrefix(filepath) + code
      const content = await prettierCode(finalCode, { filepath })
      fs.writeFileSync(filepath, content)
    }

    try {
      if (!splitLngFile && outputMap.main) {
        const filePath = outputMap.main
        const code = JSON.stringify(this.languagesMap, null, 2)
        await writeFile(filePath, code)
        return
      }

      if (splitLngFile) {
        for (const lng in outputMap) {
          if (targetLng && targetLng !== lng) continue
          const filePath = outputMap[lng]
          if (!filePath) continue
          const lngMap = Object.keys(this.languagesMap).reduce((prev, key) => {
            prev[key] = this.languagesMap[key][lng] || ''
            return prev
          }, {})
          const code = JSON.stringify(lngMap, null, 2)
          await writeFile(filePath, code)
        }
      }
    } catch (error) {
      logger.error(error as Error)
    }
  }

  /** 合并语言映射 */
  /**
   * 语种 key 集合:内置 lngList + 配置 languages + originLang
   * 用于判别语言包格式/CSV 列名,使自定义语种也能正确识别(不只用内置 lngList)
   */
  protected getLocaleKeys(): Set<string> {
    const { languages = [], originLang } = this.config
    return new Set([...lngList, ...languages, originLang])
  }

  mergeLanguagesMap(currentMap: LanguagesMap | null) {
    if (!currentMap) return
    const localeKeys = this.getLocaleKeys()
    for (const idOrLng in currentMap) {
      const item = currentMap[idOrLng]
      if (!item || typeof item !== 'object') continue
      if (localeKeys.has(idOrLng)) {
        for (let id in item) {
          this.languagesMap[id] ||= {}
          this.languagesMap[id][idOrLng] = item[id]
        }
      } else {
        for (let lng in item) {
          this.languagesMap[idOrLng] ||= {}
          this.languagesMap[idOrLng][lng] = item[lng]
        }
      }
    }
  }
}
