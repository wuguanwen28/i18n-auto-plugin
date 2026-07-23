import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'

import { decodeCsvBuffer, parseCsv } from '../utils/csv'
import { LngType, TranslateOptions } from '../types'
import { logger } from '../utils/logger'
import { LocaleCommand } from './LocaleCommand'

export interface ImportOptions extends TranslateOptions {
  /** 仅填充空白译文(--fill-only),不覆盖已有译文;默认为 false(覆盖) */
  fillOnly?: boolean
}

/**
 * import 命令:把校对好的 CSV 写回语言包。
 *
 * 以 CSV 第一列 id 定位,按表头列名匹配语种列(原文列与未知列忽略)。
 * 默认用 CSV 值覆盖所有译文(含已有);--fill-only 时仅填空白、不动已有译文。
 *
 * 流程:initConfig -> 读语言包 -> 解析 CSV -> 合并 -> writeLanguagesMap
 */
export class Import extends LocaleCommand {
  csvFile: string
  fillOnly?: boolean

  constructor(file: string, options: ImportOptions = {}) {
    super(options)
    this.csvFile = file
    this.fillOnly = options.fillOnly
  }

  async run() {
    try {
      await this.initConfig()
      await this.getOldLanguagesMap()

      const filePath = path.resolve(this.config.__rootPath, this.csvFile)
      if (!fs.existsSync(filePath)) {
        logger.error(`CSV 文件不存在: ${filePath}`)
        return
      }

      // 按字节读取后智能解码:兼容 Excel 另存的 GBK 编码,避免中文乱码
      const text = decodeCsvBuffer(fs.readFileSync(filePath))
      const count = this.mergeCsv(text)

      if (count === 0) {
        logger.print(chalk.yellow('无可写入的改动(CSV 为空,或列名与配置语种不匹配)'))
        return
      }

      await this.writeLanguagesMap()
      logger.print(
        chalk.green(
          `已${this.fillOnly ? '填充' : '覆盖'} ${count} 处译文并写回语言包`,
        ),
      )
    } catch (error) {
      logger.error(error as Error)
    }
  }

  /**
   * 解析 CSV 并合并到 languagesMap,返回实际写入的格子数。
   *
   * 原文列(originLang)是源、不是译文,仅排除不写回;id/原文是否被改动不校验,
   * 用户自行负责(强行校验会增加复杂度且收益有限)。
   *
   * @returns 写入的译文格子数(非行数)
   */
  private mergeCsv(text: string): number {
    const rows = parseCsv(text)
    if (rows.length < 2) return 0

    const header = rows[0]
    const idIdx = header.indexOf('id')
    if (idIdx === -1) {
      logger.error('CSV 表头缺少 id 列,无法定位语料')
      return 0
    }

    const { originLang } = this.config
    // 原文列:源不是译文,排除不写回
    const originIdx = header.indexOf(originLang)

    // 表头列名 -> 语种,保留合法语种列(内置 + 配置自定义);排除 id 列与原文列
    const localeKeys = this.getLocaleKeys()
    const lngCols: Array<{ idx: number; lng: LngType }> = []
    header.forEach((name, idx) => {
      if (idx !== idIdx && idx !== originIdx && localeKeys.has(name)) {
        lngCols.push({ idx, lng: name as LngType })
      }
    })
    if (!lngCols.length) return 0

    let count = 0
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      const id = row[idIdx]
      if (!id) continue

      for (const { idx, lng } of lngCols) {
        const value = (row[idx] || '').trim()
        if (!value) continue // 空值不覆盖

        this.languagesMap[id] ||= {}
        const existing = this.languagesMap[id][lng]
        // 默认覆盖;--fill-only 时仅填空白(不动已有译文)
        if (!this.fillOnly || !existing) {
          if (this.languagesMap[id][lng] !== value) {
            this.languagesMap[id][lng] = value
            count++
            // 逐条输出,与翻译过程一致,便于用户追踪进度
            const action = existing ? '覆盖' : '填充'
            logger.info(
              `${action}：${lng} ${chalk.gray(existing || '(空)')} -> ${chalk.cyan(value)}`,
            )
          }
        }
      }
    }

    return count
  }
}
