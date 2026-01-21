import fs from 'node:fs'
import path from 'node:path'

import {
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_PATH,
  DEFAULT_EXCLUDE_CALL,
  cacheManager,
  getConfiguration,
  getHash,
  isAllowTranslate,
  logger,
  parseAst,
  prettierCode,
  readFile,
  resolveTraverse,
  safeParseJson,
  scanFile,
  toArray,
  tplRegexp,
} from '../utils'
import translatorMap, { BaiduTranslator } from '../translators'
import { Configuration, LanguagesMap, TranslateOptions } from '../types'
import chalk from 'chalk'

const traverse = resolveTraverse()

export class Translate {
  configPath: string

  config!: Configuration

  languagesMap: LanguagesMap = {}

  constructor(options: TranslateOptions = {}) {
    this.configPath = options.config || DEFAULT_CONFIG_PATH
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
    const filePath = path.resolve(process.cwd(), this.configPath)
    const config = await getConfiguration(filePath)
    if (!config) {
      logger.error(
        `配置文件不存在，请执行 ${chalk.bold.green('npx i18n init')} 初始化`,
      )
      process.exit(0)
    }
    this.config = { ...DEFAULT_CONFIG, ...(config || {}) }
    let { output, __rootPath } = this.config
    if (!path.extname(output)) {
      output = path.join(output, './index.json')
      this.config.output = path.resolve(__rootPath, output)
    }
    logger.setLogLevel(this.config.logger)
  }

  /** 获取旧的语言映射 */
  async getOldLanguagesMap() {
    const filePath = this.config.output
    if (!fs.existsSync(filePath)) return
    try {
      const content = await readFile(filePath)
      this.languagesMap = content || {}
    } catch (error) {
      logger.error(error as Error)
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
    const { output: filePath } = this.config
    const dirname = path.dirname(filePath)
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true })
    }

    try {
      let code = JSON.stringify(this.languagesMap, null, 2)
      if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
        code = `export default ${code}`
      }
      const content = await prettierCode(code, { filepath: filePath })
      fs.writeFileSync(filePath, content)
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
  mergeLanguagesMap(currentMap: LanguagesMap | null) {
    if (!currentMap) return
    for (const id in currentMap) {
      if (this.languagesMap[id]) {
        this.languagesMap[id] = {
          ...this.languagesMap[id],
          ...currentMap[id],
        }
      } else {
        this.languagesMap[id] = currentMap[id]
      }
    }
  }
}
