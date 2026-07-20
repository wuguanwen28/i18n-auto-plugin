import fs from 'node:fs'
import chalk from 'chalk'
import ignore from 'ignore'
import path from 'node:path'
import prettier from 'prettier'
import crypto from 'node:crypto'
import { cosmiconfigSync } from 'cosmiconfig'
import { deepMerge } from './merge'
import { logger } from './logger'
import { Configuration, LanguagesMapById, LngType, OutputMap } from '../types'

export const getPrettierConfig = async (filePath?: string) => {
  if (!filePath) {
    filePath = (await prettier.resolveConfigFile()) || ''
  }
  const config = await prettier.resolveConfig(filePath, {
    useCache: true,
    editorconfig: true,
  })

  return config || {}
}

export const prettierCode = async (
  code?: string,
  options: prettier.Options = {},
) => {
  if (!code) return ''
  const config = await getPrettierConfig(options.filepath)
  const extname = path.extname(options.filepath || '')
  return prettier.format(code, {
    parser: extname === '.json' ? 'json' : 'babel',
    ...config,
    ...options,
  })
}

export const toArray = <T = any>(value?: T | T[]) => {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

export const resolveFileWithPath = (
  filePath: string = '',
  name = '',
): { config: any; filepath: string } | null => {
  if (!fs.existsSync(filePath) && !name) return null

  const rootPath = process.cwd()
  const searchFrom = filePath ? path.dirname(filePath) : rootPath
  const searchPlaces = filePath ? [path.basename(filePath)] : undefined

  // searchStrategy: 'global' 支持 monorepo：从执行目录一路向上查找配置
  const explorerSync = cosmiconfigSync(name, {
    searchPlaces,
    searchStrategy: 'global',
  })
  const searchedRes = explorerSync.search(searchFrom)
  if (!searchedRes?.config) return null

  let config = searchedRes.config
  if (config.__esModule && config['default']) {
    config = config['default']
  }

  return { config, filepath: searchedRes.filepath }
}

export const resolveFile = (filePath: string = '', name = '') => {
  return resolveFileWithPath(filePath, name)?.config
}

/**
 * 递归解析 extends 继承链，自底向上合并
 * @param config 当前配置
 * @param baseDir 当前配置文件所在目录（extends 相对路径的解析基准）
 * @param visited 已访问的配置文件绝对路径，用于环检测
 */
const resolveExtends = (
  config: any,
  baseDir: string,
  visited: Set<string>,
): any => {
  if (!config?.extends) return config
  if (typeof config.extends !== 'string') {
    throw new Error('extends 仅支持字符串文件路径')
  }

  const extendsPath = path.resolve(baseDir, config.extends)
  if (visited.has(extendsPath)) {
    throw new Error(
      `extends 配置成环: ${[...visited, extendsPath].join(' -> ')}`,
    )
  }
  if (!fs.existsSync(extendsPath)) {
    throw new Error(`extends 指向的配置文件不存在: ${extendsPath}`)
  }
  visited.add(extendsPath)

  const parentRes = resolveFileWithPath(extendsPath)
  const parentConfig = resolveExtends(
    parentRes?.config || {},
    path.dirname(extendsPath),
    visited,
  )

  const merged = deepMerge(parentConfig, config)
  delete merged.extends
  return merged
}

// 获取配置文件
export const getConfiguration = (filePath?: string): Configuration | null => {
  const searchedRes = resolveFileWithPath(filePath, 'i18n')
  if (!searchedRes) return null

  let config = searchedRes.config
  try {
    config = resolveExtends(
      config,
      path.dirname(searchedRes.filepath),
      new Set([searchedRes.filepath]),
    )
  } catch (error) {
    logger.error(error as Error)
    return null
  }

  // __rootPath 固定为执行目录：同一份根配置在不同子包下执行时，
  // entry/output 等相对路径各自相对子包目录解析
  config.__rootPath = process.cwd()
  config.entry = toArray(config.entry)
  config.include = toArray(config.include)
  config.exclude = toArray(config.exclude)

  // 兼容旧字段 output.file（已更名为 lngFile），下个版本移除
  if (config.output?.file && !config.output.lngFile) {
    config.output.lngFile = config.output.file
    logger.warn(
      'output.file 已更名为 output.lngFile，旧字段将在后续版本移除，请更新配置',
    )
  }

  return config
}

/**
 * 将模板字符串中的 ${...} 表达式替换为占位符,正确处理嵌套花括号
 * 如 `你好${fn({a:1})}` -> `你好{{@1}}`
 * (朴素正则在第一个 } 截断会残留 `)}`)
 * @param text 已去掉首尾反引号的模板字符串内容
 * @param replacer 接收表达式内容与序号、返回占位符
 */
export const replaceTemplateExpr = (
  text: string,
  replacer: (expr: string, index: number) => string,
): string => {
  let result = ''
  let i = 0
  let count = 0
  while (i < text.length) {
    // 匹配未转义的 ${
    if (text[i] === '$' && text[i + 1] === '{' && text[i - 1] !== '\\') {
      let depth = 1
      let j = i + 2
      // 配对花括号:遇到 { 加深,遇到 } 减浅,归零即找到表达式结尾
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        if (depth === 0) break
        j++
      }
      if (depth === 0) {
        const expr = text.slice(i + 2, j)
        result += replacer(expr, ++count)
        i = j + 1
        continue
      }
      // 未配对(理论不会发生,模板字面量语法合法),原样保留
    }
    result += text[i]
    i++
  }
  return result
}

export const createFilter = (config?: Configuration | null) => {
  const {
    include = ['src'],
    exclude = ['node_modules'],
    test = '.*(js|jsx|ts|tsx|vue)$',
    output,
    __rootPath = process.cwd(),
  } = config || {}

  const ig = ignore().add(exclude)
  const inc = ignore().add(include)
  const testRegex = test ? new RegExp(test) : null

  // 输出目录是产物(语言包/注册文件),不参与扫描与转换,
  // 否则语言包 JS/注册文件中的中文会被当作语料重新扫回
  const outDir = output?.dir
    ? path
        .relative(__rootPath, path.resolve(__rootPath, output.dir))
        .replace(/\\/g, '/')
    : ''
  if (outDir && !outDir.startsWith('.')) ig.add(outDir)

  function filter(pathname: string) {
    const relativePath = path.relative(__rootPath, pathname)
    if (relativePath.startsWith('.')) return false
    if (include?.length && !inc.ignores(relativePath)) return false
    if (ig.ignores(relativePath)) return false
    if (testRegex && !testRegex.test(relativePath)) return false
    return true
  }

  filter.excludes = ig.ignores.bind(ig)
  filter.includes = inc.ignores.bind(inc)
  filter.hasNegation = exclude.some((p) => p.startsWith('!'))

  return filter
}

/**
 * 扫描文件夹下的文件
 * @param dirPath 文件夹路径
 * @param config 配置
 * @param fn 回调函数
 */
export function scanFile(
  dirPath: string,
  config: Configuration,
  callback: (path: string) => void,
) {
  let { __rootPath } = config
  const filter = createFilter(config)

  const run = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) return
    const dirOrFiles = fs.readdirSync(dirPath, { encoding: 'utf8' })
    for (const item of dirOrFiles) {
      const filePath = path.resolve(dirPath, item)
      const relativePath = path.relative(__rootPath, filePath)
      const stat = fs.lstatSync(filePath)

      if (stat.isDirectory()) {
        if (filter.excludes(relativePath) && !filter.hasNegation) continue
        run(filePath)
        continue
      }

      if (!filter(relativePath)) continue

      callback(filePath)
    }
  }

  run(dirPath)
}

export function getHash(text: Buffer | string, length = 16): string {
  const h = crypto
    .createHash('sha256')
    .update(text)
    .digest('hex')
    .substring(0, length)
  if (length <= 64) return h
  return h.padEnd(length, '_')
}

export function mkdirSync(dirname: string) {
  if (dirname && !fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true })
  }
}

/**
 * 按文件扩展名 + 项目 package.json type 决定模块导出前缀
 * - .json:无
 * - .cjs:module.exports =
 * - .js:读执行目录 package.json,type=module 用 export default,否则 module.exports =
 *   (CJS 项目里生成 export default 会导致 cosmiconfig require 加载 SyntaxError)
 * - .mjs/其他:export default
 */
export function getExportPrefix(filePath: string) {
  if (filePath?.endsWith('.json')) return ''
  if (filePath?.endsWith('.cjs')) return 'module.exports = '
  if (filePath?.endsWith('.js')) {
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json')
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
        if (pkg.type === 'module') return 'export default '
      }
      return 'module.exports = '
    } catch {
      return 'module.exports = '
    }
  }
  return 'export default '
}

export const time = (
  name: string,
  func: () => any,
  logger: (msg: string) => void,
) => {
  const start = Date.now()
  const res = func()
  const log = () => {
    const time = Date.now() - start
    let msg = `[${name}] 耗时：${time}ms`
    if (time < 100) {
      msg = chalk.green(msg)
    } else if (time <= 1000) {
      msg = chalk.yellow(msg)
    } else if (time > 1000) {
      msg = chalk.red(msg)
    }
    logger(msg)
  }

  if (res instanceof Promise) return res.finally(log)

  log()
  return res
}

export const getOutputMap = (config: Configuration) => {
  const { output, __rootPath, languages, originLang } = config
  const { dir = './src/locale', lngFile, splitLngFile } = output
  const result: OutputMap = {}

  if (!splitLngFile) {
    const fileName = lngFile || 'index.json'
    result.main = path.resolve(__rootPath, dir, fileName)
  } else {
    let fileName = lngFile || '[name].json'
    if (!fileName.includes('[name]')) fileName = '[name].json'
    for (const lng of [...languages, originLang]) {
      const finalFileName = fileName.replace(/\[name\]/g, lng)
      const filePath = path.resolve(__rootPath, dir, finalFileName)
      result[lng] = filePath
    }
  }

  return result
}

export const readLanguagesMap = (
  config: Configuration,
  lng?: LngType,
): LanguagesMapById | null => {
  if (!config) return null

  const outputMap = getOutputMap(config)
  const { output, originLang } = config
  const { splitLngFile } = output
  lng = lng || originLang

  if (splitLngFile && outputMap[lng]) {
    return resolveFile(outputMap[lng])
  }

  if (!splitLngFile && outputMap.main) {
    return resolveFile(outputMap.main)
  }

  return null
}

export const sliceText = (text: string, maxLength = 30) => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
