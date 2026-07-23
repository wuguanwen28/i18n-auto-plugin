import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'

import { getHash, replaceTemplateExpr, scanFile, sliceText } from '../utils'
import { LanguagesMapById, LngType } from '../types'
import { DEFAULT_EXCLUDE_CALL } from '../utils/config'
import { logger } from '../utils/logger'
import { isAllowTranslate, parseAst, resolveTraverse } from '../utils/parse'
import { extractVueSfc } from '../plugins/vue-sfc'
import { LocaleCommand } from './LocaleCommand'

const traverse = resolveTraverse()

/** 单个语种的覆盖率统计 */
export interface CoverageStat {
  lng: LngType
  translated: number
  total: number
  /** 百分比,保留一位小数 */
  percent: number
}

/** 体检分析结果 */
export interface CheckReport {
  /** 存活文案(id)总数 */
  aliveCount: number
  /** 死键:语言包中存在但代码里已删除的 id */
  deadKeys: string[]
  /** 各目标语种缺失翻译的 id 列表 */
  missing: Record<string, string[]>
  /** 各目标语种覆盖率 */
  stats: CoverageStat[]
}

/**
 * check 命令:语料体检(只读)。
 *
 * 对比「扫描代码得到的存活 id 集合」与「语言包现状」,报告:
 * - 死键:语言包残留、代码里已删除的文案(可用 prune 清理)
 * - 缺失翻译:存活 id 中某目标语种译文为空/缺失
 * - 覆盖率:每个目标语种 已翻译/存活总数 的百分比
 *
 * 流程:initConfig -> 读语言包 -> 全量扫描存活 id(强制忽略缓存) -> 分析 -> 打印
 */
export class Check extends LocaleCommand {
  /** 扫描代码得到的存活 id 集合(key=id, value=中文原文) */
  aliveMap: LanguagesMapById = {}

  async run() {
    try {
      await this.initConfig()
      await this.getOldLanguagesMap()
      this.scanAliveIds()
      const report = this.analyze()
      this.printReport(report)
    } catch (error) {
      logger.error(error as Error)
    }
  }

  async initConfig() {
    await super.initConfig()
    // 体检强制全量重扫,保证存活集合准确(缓存理论上可能与代码不一致)
    this.config.cache = false
  }

  /**
   * 全量扫描代码,收集当前存活的 id -> 中文原文,写入 this.aliveMap。
   * 复用 Translate 的扫描口径(babel visitor + vue walker),保证 hash 一致,
   * 但结果收集到独立的 aliveMap,不污染 this.languagesMap(语言包现状)。
   */
  scanAliveIds() {
    const { __rootPath, entry } = this.config
    let { excludeCall = [] } = this.config
    excludeCall = [...excludeCall, ...DEFAULT_EXCLUDE_CALL]

    const addText = (text: string) => {
      const id = getHash(text)
      this.aliveMap[id] ||= {}
      this.aliveMap[id]['zh-CN'] = text
    }

    const scanScript = (code: string, filePath: string) => {
      const ast = parseAst(filePath, code)
      if (!ast) return
      traverse(ast, {
        JSXText(path) {
          if (!isAllowTranslate(path, excludeCall)) return
          addText(path.toString().trim())
        },
        StringLiteral(path) {
          if (!isAllowTranslate(path, excludeCall)) return
          addText(path.node.value.toString())
        },
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

    const scanTarget = (filePath: string) => {
      if (!fs.existsSync(filePath)) return
      const code = fs.readFileSync(filePath, 'utf-8')
      if (filePath.endsWith('.vue')) {
        const { texts, scripts } = extractVueSfc(code, filePath)
        texts.forEach(addText)
        scripts.forEach((s) => scanScript(s, filePath))
      } else {
        scanScript(code, filePath)
      }
    }

    entry.forEach((p) => {
      const dirPath = path.resolve(__rootPath, p)
      scanFile(dirPath, this.config, scanTarget)
    })
  }

  /** 对比存活集合与语言包现状,产出体检报告 */
  analyze(): CheckReport {
    const { languages } = this.config
    const aliveIds = Object.keys(this.aliveMap)
    const aliveSet = new Set(aliveIds)

    // 死键:语言包里有、存活集合里没有的 id
    const deadKeys = Object.keys(this.languagesMap).filter(
      (id) => !aliveSet.has(id),
    )

    const missing: Record<string, string[]> = {}
    const stats: CoverageStat[] = []

    for (const lng of languages) {
      const missingIds: string[] = []
      for (const id of aliveIds) {
        const text = this.languagesMap[id]?.[lng]
        if (!text) missingIds.push(id)
      }
      missing[lng] = missingIds
      const total = aliveIds.length
      const translated = total - missingIds.length
      const percent = total === 0 ? 100 : (translated / total) * 100
      stats.push({
        lng,
        translated,
        total,
        percent: Math.round(percent * 10) / 10,
      })
    }

    return { aliveCount: aliveIds.length, deadKeys, missing, stats }
  }

  /** 打印体检报告(主输出,不受日志级别控制) */
  printReport(report: CheckReport) {
    const { aliveCount, deadKeys, missing, stats } = report
    const line = '━'.repeat(30)

    logger.print(chalk.bold('\n📊 语料体检报告'))
    logger.print(line)
    logger.print(`存活文案：${chalk.cyan(aliveCount)} 条`)

    // 死键
    if (deadKeys.length) {
      logger.print(
        `\n${chalk.yellow('🗑️  死键(代码中已删除，语言包仍残留)')}：${deadKeys.length} 条`,
      )
      deadKeys.forEach((id) => {
        const text = this.languagesMap[id]?.['zh-CN'] || ''
        logger.print(`   ${chalk.gray(id)}  ${sliceText(text)}`)
      })
      logger.print(
        `\n   运行 ${chalk.cyan.bold('npx i18n prune')} 清理死键`,
      )
    } else {
      logger.print(chalk.green('\n✅ 无死键'))
    }

    // 缺失翻译
    const missingLngs = Object.keys(missing).filter((l) => missing[l].length)
    if (missingLngs.length) {
      logger.print(`\n${chalk.yellow('⚠️  缺失翻译')}：`)
      missingLngs.forEach((lng) => {
        logger.print(`   ${lng}：${missing[lng].length} 条未翻译`)
      })
    } else {
      logger.print(chalk.green('\n✅ 无缺失翻译'))
    }

    // 覆盖率
    if (stats.length) {
      logger.print(`\n${chalk.bold('📈 翻译覆盖率')}：`)
      stats.forEach(({ lng, translated, total, percent }) => {
        const color =
          percent >= 100 ? chalk.green : percent >= 80 ? chalk.yellow : chalk.red
        logger.print(
          `   ${lng.padEnd(8)}${color(`${percent}%`)}  (${translated}/${total})`,
        )
      })
    }

    logger.print(line)
  }
}
