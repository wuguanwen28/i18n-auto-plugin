import fs from 'node:fs'
import path from 'node:path'

import {
  DEFAULT_CONFIG,
  DEFAULT_EXCLUDE_CALL,
  cacheManager,
  getConfiguration,
  getExportPrefix,
  getHash,
  isAllowTranslate,
  logger,
  mkdirSync,
  parseAst,
  prettierCode,
  resolveFile,
  resolveTraverse,
  scanFile,
  toArray,
  tplRegexp,
} from '../utils'
import translatorMap, { BaiduTranslator } from '../translators'
import {
  Configuration,
  LanguagesMap,
  LngType,
  TranslateOptions,
} from '../types'
import chalk from 'chalk'

const traverse = resolveTraverse()

export class Translate {
  customConfigPath?: string

  config!: Configuration

  languagesMap: LanguagesMap = {}

  constructor(options: TranslateOptions = {}) {
    this.customConfigPath = options.config
  }

  async run() {
    try {
      await this.initConfig()
      await this.getOldLanguagesMap()
      await this.getNewLanguagesMap()
      await this.writeLanguagesMap()
      await this.translate()
      logger.info('翻译完成')
    } catch (error) {
      logger.error(error as Error)
    }
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
    logger.setLogLevel(this.config.logger)
  }

  /** 获取旧的语言映射 */
  async getOldLanguagesMap() {
    const outputMap = this.getOutputMap()
    const mainPath = outputMap.main
    if (mainPath && fs.existsSync(mainPath)) {
      const content = await resolveFile(mainPath)
      this.languagesMap = content || {}
    } else {
      for (const lng in outputMap) {
        const filePath = outputMap[lng]
        if (filePath && fs.existsSync(filePath)) {
          const content = await resolveFile(filePath)
          this.mergeLanguagesMap(content, lng as LngType)
        }
      }
    }
  }

  /** 获取新的语言映射 */
  async getNewLanguagesMap() {
    const dir = toArray(this.config.entry)
    const __rootPath = this.config.__rootPath
    dir.forEach((p) => {
      const dirPath = path.resolve(__rootPath, p)
      scanFile(dirPath, this.config, (p) => this.scanTargetLang(p))
    })
  }

  /** 扫描文件中的目标语言 */
  scanTargetLang(filePath: string) {
    let languagesMap: LanguagesMap | null = null
    if (this.config.cache) languagesMap = cacheManager.getCache(filePath)

    if (!languagesMap) {
      logger.info(`发现文件: ${filePath}`)

      const ast = parseAst(filePath)
      if (!ast) return

      let { excludeCall = [] } = this.config || {}
      excludeCall = [...excludeCall, ...DEFAULT_EXCLUDE_CALL]

      let result: LanguagesMap = {}
      const addText = (text: string) => {
        const id = getHash(text)
        result[id] = result[id] || {}
        result[id]['zh-CN'] = text
      }

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
          const text = path
            .toString()
            .replace(/^`|`$/g, '')
            .replace(tplRegexp, () => `{{@${++i}}}`)
          addText(text)
        },
      })

      languagesMap = result
    }

    languagesMap! && cacheManager.setCache(filePath, languagesMap)

    this.mergeLanguagesMap(languagesMap)
  }

  /** 写入语言映射 */
  async writeLanguagesMap() {
    const outputMap = this.getOutputMap()
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
          const filePath = outputMap[lng]
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

  /** 翻译 */
  async translate() {
    const { translateService = 'baidu' } = this.config
    const Translator = translatorMap[translateService] || BaiduTranslator
    const translator = new Translator(this)
    await translator.run(() => {
      this.writeLanguagesMap()
    })
  }

  /** 合并语言映射 */
  mergeLanguagesMap(
    currentMap: LanguagesMap | Record<string, string> | null,
    key?: LngType,
  ) {
    if (!currentMap) return
    for (const id in currentMap) {
      const item = currentMap[id]
      this.languagesMap[id] ||= {}
      if (typeof item === 'string') {
        if (!key) throw new Error('key is required')
        this.languagesMap[id] = {
          ...this.languagesMap[id],
          [key]: item,
        }
      } else if (typeof item === 'object') {
        this.languagesMap[id] = {
          ...this.languagesMap[id],
          ...item,
        }
      }
    }
  }

  getOutputMap() {
    const { output, __rootPath, languages, originLang } = this.config
    const { dir = DEFAULT_CONFIG.output.dir!, file, splitLngFile } = output

    const result: { [key in LngType | 'main']?: string } = {}

    if (!splitLngFile) {
      const fileName = file || 'index.json'
      result.main = path.resolve(__rootPath, dir, fileName)
    } else {
      let fileName = file || '[name].json'
      if (!fileName.includes('[name]')) fileName = '[name].json'
      for (const lng of [...languages, originLang]) {
        const finalFileName = fileName.replace(/\[name\]/g, lng)
        const filePath = path.resolve(__rootPath, dir, finalFileName)
        result[lng] = filePath
      }
    }

    return result
  }
}
