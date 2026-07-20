import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'fs'
import { resolve } from 'path'
import { getHash } from '.'
import { Configuration } from '../types'

/**
 * 提取影响扫描结果的配置指纹
 * 仅纳入"同一份源文件解析出的 data 会因这些字段变化而不同"的配置:
 * excludeCall(跳过哪些函数)、test(扫哪些扩展名)、
 * include/exclude(扫哪些目录)、originLang(提取文本存进哪个语种字段)
 * 翻译服务、batchSize、output 路径等不影响扫描结果,不纳入
 */
const getConfigHash = (config: Configuration): string => {
  const { excludeCall, test, include, exclude, originLang } = config
  return getHash(JSON.stringify({ excludeCall, test, include, exclude, originLang }))
}

class CacheManager {
  CACHE_VERSION = 1

  private cacheDir: string = resolve(
    process.cwd(),
    'node_modules/.cache/i18n-auto-plugin',
  )

  getCache<T = any>(filePath: string, config: Configuration): T | null {
    const key = getHash(filePath)
    const cacheFile = resolve(this.cacheDir, `${key}.json`)

    if (!existsSync(cacheFile)) return null

    try {
      const cache = JSON.parse(readFileSync(cacheFile, 'utf-8'))

      if (cache.version !== this.CACHE_VERSION) return null

      const stat = statSync(filePath)
      const currentHash = getHash(readFileSync(filePath))

      if (cache.mtime !== stat.mtimeMs || cache.hash !== currentHash) {
        return null
      }

      // 配置变化(excludeCall/test/include/exclude/originLang)导致扫描结果不同,
      // 配置指纹不符时视为失效,强制重新解析
      if (cache.configHash !== getConfigHash(config)) {
        return null
      }

      return cache.data as T
    } catch {
      return null
    }
  }

  setCache<T = any>(filePath: string, data: T, config: Configuration) {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true })
    }

    const key = getHash(filePath)
    const cacheFile = resolve(this.cacheDir, `${key}.json`)

    const stat = statSync(filePath)

    const cache = {
      version: this.CACHE_VERSION,
      hash: getHash(readFileSync(filePath)),
      mtime: stat.mtimeMs,
      configHash: getConfigHash(config),
      data,
    }

    writeFileSync(cacheFile, JSON.stringify(cache), 'utf-8')
  }
}

export const cacheManager = new CacheManager()