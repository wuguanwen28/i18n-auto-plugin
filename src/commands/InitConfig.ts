import path, { dirname, resolve } from 'path'
import { InitConfigOptions } from '../types'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import {
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_PATH,
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

      const ext = path.extname(filePath) || '.json'
      const comment = `/** @type {import('i18n-auto-plugin').I18nConfig} */`

      let exportType = ''
      if (ext === '.cjs') {
        exportType = 'module.exports ='
      } else if (ext === '.mjs' || ext === '.js') {
        exportType = 'export default'
      }

      const code = JSON.stringify(DEFAULT_CONFIG, null, 2)
      const content = `${exportType ? comment : ''}\n${exportType} ${code}`

      mkdirSync(dirname(filePath), { recursive: true })

      const prettierContent = await prettierCode(content, {
        filepath: filePath,
        parser: ext === '.json' ? 'json' : 'babel',
      })

      writeFileSync(filePath, prettierContent, { encoding: 'utf-8' })

      logger.info('生成成功')
    } catch (error) {
      logger.error(error as any)
    }
  }
}
