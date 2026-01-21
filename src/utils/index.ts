import fs from 'node:fs'
import ignore from 'ignore'
import path from 'node:path'
import prettier from 'prettier'
import crypto from 'node:crypto'
import { cosmiconfig } from 'cosmiconfig'
import { Configuration } from '../types'
import { DEFAULT_CONFIG_PATH } from './config'

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

export const readFile = async (filePath: string) => {
  if (!fs.existsSync(filePath)) return
  const filename = path.basename(filePath)
  const dirname = path.dirname(filePath)
  const explorer = cosmiconfig('', {
    searchPlaces: [filename],
  })

  const searchedFor = await explorer.search(dirname)

  if (!searchedFor?.config) return null

  let res = searchedFor.config
  if (res.__esModule && res['default']) {
    return res['default']
  }

  return res
}

// 获取配置文件
export const getConfiguration = async (
  filePath: string = '',
): Promise<Configuration | null> => {
  const __rootPath = process.cwd()
  const filename = path.basename(filePath)
  const dirname = path.dirname(filePath) || __rootPath
  const filenames = [filename].filter(
    (item) => item && item !== DEFAULT_CONFIG_PATH,
  )
  const explorerSync = cosmiconfig('i18n', {
    searchPlaces: filenames.length ? filenames : void 0,
  })

  const searchedFor = await explorerSync.search(dirname)
  if (!searchedFor?.config) return null

  let config = searchedFor.config as Configuration
  // @ts-ignore
  if (config.__esModule && config['default']) {
    config = config['default']
  }

  if (typeof config.test === 'string') {
    config.test = new RegExp(config.test)
  }

  config.__rootPath = __rootPath
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
