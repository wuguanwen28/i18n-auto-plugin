import chalk from 'chalk'

import { sliceText } from '../utils'
import { confirmOverwrite } from '../utils/prompt'
import { logger } from '../utils/logger'
import { Check } from './Check'

/**
 * prune 命令:清理死键(写操作)。
 *
 * 复用 Check 的体检分析,列出死键后经 confirmOverwrite 确认,
 * 从语言包中删除死键 id 并写回。非 TTY(CI)环境不删,安全退出。
 *
 * 不备份原语言包:写回前有确认,且依赖 git 兜底(见 CLAUDE.md 约定)。
 *
 * 流程:initConfig -> 读语言包 -> 扫描存活 id -> 分析 -> 确认 -> 删除 -> 写回
 */
export class Prune extends Check {
  async run() {
    try {
      await this.initConfig()
      await this.getOldLanguagesMap()
      this.scanAliveIds()
      const { deadKeys } = this.analyze()

      if (!deadKeys.length) {
        logger.print(chalk.green('✅ 无死键需清理'))
        return
      }

      logger.print(`\n${chalk.yellow('🗑️  以下死键将被删除')}：${deadKeys.length} 条`)
      deadKeys.forEach((id) => {
        const text = this.languagesMap[id]?.['zh-CN'] || ''
        logger.print(`   ${chalk.gray(id)}  ${sliceText(text)}`)
      })

      const ok = await confirmOverwrite(`将删除 ${deadKeys.length} 条死键，是否继续？`)
      if (!ok) {
        logger.print('已取消,未修改语言包')
        return
      }

      deadKeys.forEach((id) => delete this.languagesMap[id])
      await this.writeLanguagesMap()
      logger.print(chalk.green(`已删除 ${deadKeys.length} 条死键并写回语言包`))
    } catch (error) {
      logger.error(error as Error)
    }
  }
}
