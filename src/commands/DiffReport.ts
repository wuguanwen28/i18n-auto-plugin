import fs from 'node:fs'
import path from 'node:path'
import { Configuration, DiffReport, LanguagesMapById } from '../types'
import { mkdirSync, prettierCode, resolveFile } from '../utils'
import { confirmOverwrite } from '../utils/prompt'
import { logger } from '../utils/logger'

/**
 * 检查旧 diff.json 是否有用户未应用的 suggested 修改:
 * 旧 diff.json 的 suggested 与当前语言包不一致 = 用户改过但没 apply
 * (apply 会把 suggested 写回语言包,二者一致;改了没 apply 则不一致)
 */
const hasUnappliedChanges = (
  report: DiffReport | null,
  languagesMap: LanguagesMapById,
): boolean => {
  if (!report) return false
  for (const toLng in report) {
    for (const item of report[toLng] || []) {
      if (item.suggested == null) continue
      const current = languagesMap[item.id]?.[toLng]
      if (current !== item.suggested) return true
    }
  }
  return false
}

/**
 * 写入差异报告到 output.dir/output.diffFile
 * 报告仅含 consensus: false 条目(由调用方保证)
 * 无差异时不写盘(避免产生空文件)
 * 若报告已存在且含用户未应用的 suggested 修改,阻塞询问是否覆盖
 * (没改过/已 apply 则直接覆盖,无损失)
 */
export const writeDiffReport = async (
  config: Configuration,
  report: DiffReport,
  languagesMap: LanguagesMapById,
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

  // diff.json 已存在时,检查是否有用户未应用的 suggested 修改
  if (fs.existsSync(filePath)) {
    const oldReport = (await resolveFile(filePath)) as DiffReport | null
    if (hasUnappliedChanges(oldReport, languagesMap)) {
      // 有未应用修改,阻塞确认(覆盖会丢失用户修改)
      const overwrite = await confirmOverwrite(
        `差异报告 ${diffFile} 含未应用的 suggested 修改,覆盖会丢失,是否继续?`,
      )
      if (!overwrite) {
        logger.warn('已跳过差异报告写入(保留现有 diff.json,建议先 npx i18n apply)')
        return
      }
    }
    // 无未应用修改(或已 apply),直接覆盖(无损失)
  }

  const code = JSON.stringify(report, null, 2)
  mkdirSync(path.dirname(filePath))
  const content = await prettierCode(code, { filepath: filePath })
  fs.writeFileSync(filePath, content)

  logger.warn(`差异报告已生成(${count} 条差异): ${filePath}`)
}
