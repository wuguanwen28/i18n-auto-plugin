import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import chalk from 'chalk'
import { Configuration, OutputMap } from '../types'
import { mkdirSync, prettierCode } from '../utils'
import { logger } from '../utils/logger'

/** 指纹标记:含此行的文件视为工具生成,可安全覆盖 */
const GENERATED_MARK = '[i18n-auto] generated'

/** 生成文件的头部说明注释 + 指纹标记行 */
const FILE_HEADER = `/* eslint-disable */
/**
 * 本文件由 i18n-auto-plugin 自动生成
 * 作用:加载语言包并注册到 i18n 运行时。
 *
 * 每次执行 npx i18n 会按最新配置重新生成本文件,请勿直接修改。
 * 如需自定义(如更换 storage、增加逻辑):删除下面的 [i18n-auto] 标记行,
 * 此后工具将不再覆盖本文件,语言包更新需自行维护 import。
 */
// ${GENERATED_MARK}
`

/** 语种码转驼峰变量名:zh-CN → zhCN */
const toVarName = (lng: string) => {
  return lng.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())
}

/** 计算 from 文件所在目录到 to 文件的 import 相对路径(POSIX 分隔符,带 ./ 前缀) */
const toImportPath = (fromFile: string, toFile: string) => {
  let rel = path.relative(path.dirname(fromFile), toFile).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

/** 决定注册文件的绝对路径,registerFile 为 false 时返回 null */
export const getRegisterFilePath = (config: Configuration): string | null => {
  const { output, __rootPath } = config
  const { registerFile = true, dir = './src/locale' } = output

  if (registerFile === false) return null
  // 字符串:与 output.lngFile 一致,相对 output.dir 解析
  if (typeof registerFile === 'string') {
    return path.resolve(__rootPath, dir, registerFile)
  }

  // true:生成到 output.dir 下,按执行目录是否有 tsconfig.json 决定扩展名
  const isTs = fs.existsSync(path.resolve(__rootPath, 'tsconfig.json'))
  return path.resolve(__rootPath, dir, isTs ? 'index.ts' : 'index.js')
}

/** 生成注册文件内容(不含格式化) */
export const buildRegisterCode = (
  config: Configuration,
  outputMap: OutputMap,
  registerPath: string,
): string | null => {
  const { output, importInfo, languages, originLang } = config
  const source = importInfo?.source || __NAME__

  if (!output.splitLngFile) {
    if (!outputMap.main) return null
    const jsonPath = toImportPath(registerPath, outputMap.main)
    return (
      FILE_HEADER +
      `import lngMap from '${jsonPath}'\n` +
      `import { extendLocale } from '${source}'\n\n` +
      `extendLocale(lngMap)\n`
    )
  }

  // 分文件:按 [...languages, originLang] 逐个 import 后统一注册
  const lngs = [...languages, originLang]
  const imports: string[] = []
  const entries: string[] = []
  for (const lng of lngs) {
    const filePath = outputMap[lng]
    if (!filePath) continue
    const varName = toVarName(lng)
    imports.push(`import ${varName} from '${toImportPath(registerPath, filePath)}'`)
    entries.push(`'${lng}': ${varName}`)
  }
  if (!imports.length) return null

  return (
    FILE_HEADER +
    imports.join('\n') +
    `\nimport { extendLocale } from '${source}'\n\n` +
    `extendLocale({ ${entries.join(', ')} })\n`
  )
}

/** 交互式询问是否覆盖已被接管的注册文件(仅 TTY 环境,默认否) */
const confirmOverwrite = async (registerPath: string): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  try {
    const answer = await rl.question(
      chalk.yellow(`注册文件已存在且无生成标记: ${registerPath}\n是否覆盖?(y/N) `),
    )
    return answer.trim().toLowerCase() === 'y'
  } finally {
    rl.close()
  }
}

/**
 * 生成注册文件
 * 覆盖规则:文件不存在 → 生成;存在且含指纹标记 → 覆盖重生成;
 * 存在但无标记 → 用户已接管:TTY 环境询问是否覆盖(默认否),
 * 非 TTY(CI 等)直接跳过并提示
 */
export const generateRegisterFile = async (
  config: Configuration,
  outputMap: OutputMap,
) => {
  const registerPath = getRegisterFilePath(config)
  if (!registerPath) return

  let oldContent = ''
  if (fs.existsSync(registerPath)) {
    oldContent = fs.readFileSync(registerPath, 'utf-8')
    if (!oldContent.includes(GENERATED_MARK)) {
      if (!process.stdin.isTTY) {
        logger.warn(`注册文件已被接管,跳过生成: ${registerPath}`)
        return
      }
      const overwrite = await confirmOverwrite(registerPath)
      if (!overwrite) {
        logger.info(`已保留现有注册文件: ${registerPath}`)
        return
      }
    }
  }

  const code = buildRegisterCode(config, outputMap, registerPath)
  if (!code) return

  const content = await prettierCode(code, { filepath: registerPath })
  // 内容未变化时不重写不提示,避免每次执行都触发 watcher 与日志噪音
  if (content === oldContent) return

  mkdirSync(path.dirname(registerPath))
  fs.writeFileSync(registerPath, content)
  logger.info(`注册文件已生成: ${registerPath}`)
}
