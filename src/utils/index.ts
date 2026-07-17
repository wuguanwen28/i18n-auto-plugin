import fs from 'node:fs'
import chalk from 'chalk'
import ignore from 'ignore'
import path from 'node:path'
import prettier from 'prettier'
import crypto from 'node:crypto'
import { cosmiconfigSync } from 'cosmiconfig'
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

export const resolveFile = (filePath: string = '', name = '') => {
  if (!fs.existsSync(filePath) && !name) return

  const rootPath = process.cwd()
  const searchFrom = filePath ? path.dirname(filePath) : rootPath
  const searchPlaces = filePath ? [path.basename(filePath)] : undefined

  const explorerSync = cosmiconfigSync(name, { searchPlaces })
  const searchedRes = explorerSync.search(searchFrom)
  if (!searchedRes?.config) return null

  let res = searchedRes.config
  if (res.__esModule && res['default']) {
    return res['default']
  }

  return res
}

// 获取配置文件
export const getConfiguration = (filePath?: string): Configuration | null => {
  const config = resolveFile(filePath, 'i18n')
  if (!config) return null
  config.__rootPath = process.cwd()
  config.entry = toArray(config.entry)
  config.include = toArray(config.include)
  config.exclude = toArray(config.exclude)

  return config
}

export const createFilter = (config?: Configuration | null) => {
  const {
    include = ['src'],
    exclude = ['node_modules'],
    test = '.*(js|jsx|ts|tsx|vue)$',
    __rootPath = process.cwd(),
  } = config || {}

  const ig = ignore().add(exclude)
  const inc = ignore().add(include)
  const testRegex = test ? new RegExp(test) : null

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

export function getExportPrefix(filePath: string) {
  if (filePath?.endsWith('.json')) return ''
  if (filePath?.endsWith('.cjs')) return 'module.exports = '
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
  const { dir = './src/locale', file, splitLngFile } = output
  const result: OutputMap = {}

  if (!splitLngFile) {
    const fileName = file || 'index.json'
    result.main = path.resolve(__rootPath, dir, fileName)
  } else {
    let fileName = file || '[name].json'
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
