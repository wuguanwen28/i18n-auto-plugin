/**
 * 零依赖 CSV 序列化/解析(遵循 RFC 4180 转义规则)。
 *
 * 语言包是扁平表结构(id + 原文 + 各语种译文),CSV 足以承载,
 * 且 Excel/WPS/Numbers/Google Sheets 均可直接打开编辑,无需引入 xlsx 等重依赖。
 */

/** UTF-8 BOM:导出时前置,Excel 打开才不会把中文识别成乱码 */
export const UTF8_BOM = '﻿'

/**
 * 智能解码 CSV 字节:兼容 Excel 在中文 Windows 上另存的 GBK 编码。
 *
 * 判定顺序:
 * 1. UTF-8 / UTF-16 BOM → 按对应编码解码
 * 2. 无 BOM:严格(fatal)UTF-8 解码,成功即 UTF-8
 * 3. UTF-8 解码抛错 → 回退 GBK(中文版 Excel 存 CSV 的默认编码)
 *
 * 依赖 Node 完整 ICU(node >= 20.19 / 22.12 默认满足)提供 gbk 解码。
 */
export const decodeCsvBuffer = (buf: Buffer): string => {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buf)
  }
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buf)
  }
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buf)
  }
  try {
    // 严格模式:非法 UTF-8 字节序列会抛错,借此区分 UTF-8 与 GBK
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    try {
      return new TextDecoder('gbk').decode(buf)
    } catch {
      // 极端环境(small-icu)无 gbk 解码器:退回宽松 UTF-8,至少不崩
      return new TextDecoder('utf-8').decode(buf)
    }
  }
}

/**
 * 单个字段转义:含逗号、双引号、换行时用双引号包裹,内部双引号翻倍。
 */
const escapeField = (field: string): string => {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

/**
 * 二维数组 -> CSV 文本。行以 \r\n 分隔(Excel 兼容),不含 BOM。
 */
export const stringifyCsv = (rows: string[][]): string => {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n')
}

/**
 * CSV 文本 -> 二维数组。状态机解析,正确处理引号内的逗号与换行。
 * 自动剥除开头的 UTF-8 BOM;兼容 \n 与 \r\n 行分隔。
 */
export const parseCsv = (text: string): string[][] => {
  // 剥 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        // 引号内的 "":转义为一个 "
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      pushField()
      i++
      continue
    }
    if (ch === '\r') {
      // \r\n 作为一个换行处理
      if (text[i + 1] === '\n') i++
      pushRow()
      i++
      continue
    }
    if (ch === '\n') {
      pushRow()
      i++
      continue
    }
    field += ch
    i++
  }

  // 收尾:最后一个字段/行(无尾随换行时)
  if (field.length > 0 || row.length > 0) {
    pushRow()
  }

  return rows
}
