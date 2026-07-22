import fs from 'node:fs'
import path from 'node:path'
import { Translate } from './Translate'
import { DiffReport, LngType } from '../types'
import { resolveFile } from '../utils'
import { logger } from '../utils/logger'

/**
 * apply 命令:读 diff.json,把用户修改后的 suggested 应用回语言包。
 *
 * 多服务翻译(translateService 配多个服务)会生成 diff.json,含各服务译文
 * 差异与 suggested 建议值。用户可手动改 diff.json 的 suggested(选定/改正译文),
 * 再运行 apply,把修改后的 suggested 写回语言包--无需逐个查 hash 改语言包。
 *
 * 流程:initConfig -> 读语言包 -> 应用 diff suggested -> 写语言包
 * (不扫描、不翻译,只根据 diff.json 修改已有语言包)
 */
export class Apply extends Translate {
  async run() {
    try {
      await this.initConfig()
      await this.getOldLanguagesMap()
      const count = await this.applyDiff()
      if (count > 0) {
        await this.writeLanguagesMap()
        logger.info(`已应用 ${count} 条差异修改到语言包`)
      }
    } catch (error) {
      logger.error(error as Error)
    }
  }

  /**
   * 读 diff.json,把每条 suggested 应用到 this.languagesMap
   * @returns 应用条数(0 表示无差异或报告不存在/为空)
   */
  async applyDiff(): Promise<number> {
    const { output, __rootPath } = this.config
    const { dir = './src/locale', diffFile = 'diff.json' } = output
    const diffPath = path.resolve(__rootPath, dir, diffFile)

    if (!fs.existsSync(diffPath)) {
      logger.error(
        `差异报告不存在: ${diffPath}\n请先运行多服务翻译(translateService 配多个服务)生成 diff.json`,
      )
      return 0
    }

    const report = (await resolveFile(diffPath)) as DiffReport | null
    if (!report) {
      logger.error('差异报告为空')
      return 0
    }

    let count = 0
    for (const toLng in report) {
      const items = report[toLng] || []
      for (const item of items) {
        if (item.suggested == null) continue
        this.languagesMap[item.id] ||= {}
        this.languagesMap[item.id][toLng as LngType] = item.suggested
        count++
      }
    }
    return count
  }
}
