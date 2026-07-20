import fs from 'node:fs'
import path from 'node:path'
import { Configuration, DiffReport } from '../types'
import { mkdirSync, prettierCode } from '../utils'
import { logger } from '../utils/logger'

/**
 * 写入差异报告到 output.dir/output.diffFile
 * 报告仅含 consensus: false 条目(由调用方保证)
 * 无差异时不写盘(避免产生空文件)
 */
export const writeDiffReport = async (
  config: Configuration,
  report: DiffReport,
) => {
  // 统计差异条目数
  const count = Object.values(report).reduce(
    (sum, items) => sum + (items?.length || 0),
    0,
  )

  if (count === 0) return

  const { output, __rootPath } = config
  const { dir = './src/locale', diffFile = 'diff.json' } = output
  const filePath = path.resolve(__rootPath, dir, diffFile)

  const code = JSON.stringify(report, null, 2)
  mkdirSync(path.dirname(filePath))
  const content = await prettierCode(code, { filepath: filePath })
  fs.writeFileSync(filePath, content)

  logger.warn(`差异报告已生成(${count} 条差异): ${filePath}`)
}
