import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'

import { mkdirSync } from '../utils'
import { stringifyCsv, UTF8_BOM } from '../utils/csv'
import { TranslateOptions } from '../types'
import { logger } from '../utils/logger'
import { LocaleCommand } from './LocaleCommand'

export interface ExportOptions extends TranslateOptions {
  /** 输出文件路径(--out/-o),默认 output.dir/i18n.csv */
  out?: string
  /** 只导出有缺失译文的行(--missing) */
  missing?: boolean
}

/**
 * export 命令:把语言包导出为 CSV,交给翻译人员校对。
 *
 * CSV 结构:第一列 id,第二列原文(originLang,仅供参考),后续每个目标语种一列。
 * 默认导出全部;--missing 只导出「有目标语种缺译」的行。
 *
 * 两种语言包格式(单文件 by-id / 分文件 by-locale)经 getOldLanguagesMap
 * 归一化为 languagesMap,导出逻辑无需区分。
 *
 * 流程:initConfig -> 读语言包 -> 组装 CSV 行 -> 写 CSV 文件(带 UTF-8 BOM)
 */
export class Export extends LocaleCommand {
  outFile?: string
  onlyMissing?: boolean

  constructor(options: ExportOptions = {}) {
    super(options)
    this.outFile = options.out
    this.onlyMissing = options.missing
  }

  async run() {
    try {
      await this.initConfig()
      await this.getOldLanguagesMap()
      const { rows, count } = this.buildRows()

      if (count === 0) {
        logger.print(
          this.onlyMissing
            ? chalk.green('✅ 无缺失译文,无需导出')
            : chalk.yellow('语言包为空,无可导出内容'),
        )
        return
      }

      const filePath = this.resolveOutPath()
      mkdirSync(path.dirname(filePath))
      fs.writeFileSync(filePath, UTF8_BOM + stringifyCsv(rows))
      logger.print(
        chalk.green(`已导出 ${count} 条${this.onlyMissing ? '(仅缺失)' : ''}到 `) +
          chalk.cyan(filePath),
      )
    } catch (error) {
      logger.error(error as Error)
    }
  }

  /** 组装 CSV 行:表头 + 数据行 */
  private buildRows(): { rows: string[][]; count: number } {
    const { originLang, languages } = this.config
    // 表头:id, 原文语种, ...各目标语种
    const header = ['id', originLang, ...languages]
    const rows: string[][] = [header]
    let count = 0

    for (const id in this.languagesMap) {
      const item = this.languagesMap[id] || {}
      const origin = item[originLang] || ''

      // --missing:任一目标语种为空才导出
      if (this.onlyMissing) {
        const hasMissing = languages.some((lng) => !item[lng])
        if (!hasMissing) continue
      }

      const row = [id, origin, ...languages.map((lng) => item[lng] || '')]
      rows.push(row)
      count++
    }

    return { rows, count }
  }

  /** 解析输出路径:--out 优先,否则 output.dir/i18n.csv */
  private resolveOutPath(): string {
    const { __rootPath, output } = this.config
    if (this.outFile) return path.resolve(__rootPath, this.outFile)
    const dir = output?.dir || './src/locale'
    return path.resolve(__rootPath, dir, 'i18n.csv')
  }
}
