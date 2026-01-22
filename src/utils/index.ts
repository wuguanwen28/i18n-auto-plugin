import fs from 'node:fs'
import ignore from 'ignore'
import path from 'node:path'
import prettier from 'prettier'
import crypto from 'node:crypto'
import { cosmiconfig } from 'cosmiconfig'
import { Configuration } from '../types'

export * from './parse'
export * from './ceche'
export * from './config'
export * from './logger'

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

export const resolveFile = async (filePath: string = '', name = '') => {
  if (!fs.existsSync(filePath) && !name) return

  const rootPath = process.cwd()
  const searchFrom = filePath ? path.dirname(filePath) : rootPath
  const searchPlaces = filePath ? [path.basename(filePath)] : undefined

  const explorer = cosmiconfig(name, { searchPlaces })
  const searchedRes = await explorer.search(searchFrom)
  if (!searchedRes?.config) return null

  let res = searchedRes.config
  if (res.__esModule && res['default']) {
    return res['default']
  }

  return res
}

// 获取配置文件
export const getConfiguration = async (
  filePath: string = '',
): Promise<Configuration | null> => {
  const config = await resolveFile(filePath, 'i18n')
  if (!config) return null
  config.__rootPath = process.cwd()
  config.test = new RegExp(config.test)
  config.include = toArray(config.include)
  config.exclude = toArray(config.exclude)

  return config
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
  let { test: fileRegex, exclude = [], include = [], __rootPath } = config
  fileRegex = new RegExp(fileRegex)

  const ig = ignore().add(exclude)
  const inc = ignore().add(include)

  const hasNegation = exclude.some((p) => p.startsWith('!'))
  const dirOrFiles = fs.readdirSync(dirPath, { encoding: 'utf8' })

  for (const item of dirOrFiles) {
    const filePath = path.resolve(dirPath, item)
    const relativePath = path.relative(__rootPath, filePath)
    const stat = fs.lstatSync(filePath)

    if (stat.isDirectory()) {
      if (ig.ignores(relativePath) && !hasNegation) continue
      scanFile(filePath, config, callback)
      continue
    }

    if (ig.ignores(relativePath)) continue
    if (include.length && !inc.ignores(relativePath)) continue
    if (!fileRegex.test(item)) continue

    callback(filePath)
  }
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

export function safeParseJson<T = any>(str: string, defaultValue?: T): T {
  try {
    return JSON.parse(str)
  } catch (error) {
    return defaultValue as T
  }
}

export function mkdirSync(dirname: string) {
  if (dirname && !fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true })
  }
}

export function getExportPrefix(filePath: string) {
  if (filePath?.endsWith('.json')) return ''
  if (filePath?.endsWith('.cjs')) return 'module.exports = '
  return 'export default '
}
