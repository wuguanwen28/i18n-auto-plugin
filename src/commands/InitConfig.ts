import { dirname, resolve } from 'path'
import { InitConfigOptions } from '../types'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import {
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_PATH,
  getExportPrefix,
  logger,
  prettierCode,
} from '../utils'

export class InitConfig {
  force: boolean
  path: string
  constructor(options?: InitConfigOptions) {
    this.force = !!options?.force
    this.path = options?.config || DEFAULT_CONFIG_PATH
  }

  async run() {
    try {
      const filePath = resolve(process.cwd(), this.path)
      if (existsSync(filePath) && !this.force) {
        logger.warn('target file already exists, use --force to override')
        return
      }

      const comment = `/** @type {import('i18n-auto-plugin').I18nConfig} */`

      let exportType = getExportPrefix(filePath)
      const code = JSON.stringify(DEFAULT_CONFIG, null, 2)
      const content = `${exportType ? comment : ''}\n${exportType} ${code}`

      mkdirSync(dirname(filePath), { recursive: true })

      const prettierContent = await prettierCode(content, {
        filepath: filePath,
      })

      writeFileSync(filePath, prettierContent, { encoding: 'utf-8' })

      logger.info(`config file created: ${filePath}`)
    } catch (error) {
      logger.error(error as any)
    }
  }
}
