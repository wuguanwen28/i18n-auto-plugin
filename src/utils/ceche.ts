import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'fs'
import { resolve } from 'path'
import { getHash } from '.'

class CacheManager {
  CACHE_VERSION = 1

  private cacheDir: string = resolve(
    process.cwd(),
    'node_modules/.cache/i18n-auto-plugin',
  )

  getCache<T = any>(filePath: string): T | null {
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

      return cache.data as T
    } catch {
      return null
    }
  }

  setCache<T = any>(filePath: string, data: T) {
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
      data,
    }

    writeFileSync(cacheFile, JSON.stringify(cache), 'utf-8')
  }
}

export const cacheManager = new CacheManager()