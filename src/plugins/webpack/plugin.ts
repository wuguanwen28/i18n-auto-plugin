import { Compiler } from 'webpack'
import { createFilter, getConfiguration, readLanguagesMap } from '../../utils'

type I18nAutoWebpackPluginOptions = {
  configPath?: string
}

class I18nAutoWebpackPlugin {
  options: I18nAutoWebpackPluginOptions = {}
  constructor(options: I18nAutoWebpackPluginOptions = {}) {
    this.options = options
  }

  static loader = require.resolve('./webpack-loader.cjs')

  apply(compiler: Compiler) {
    const isHasLoader = (rules: any[]) => {
      if (!rules) return false
      return rules.some((rule) => {
        return rule?.use?.some(
          (use) => use?.loader === I18nAutoWebpackPlugin.loader,
        )
      })
    }

    const { configPath = '' } = this.options

    const config = getConfiguration(configPath)

    if (!config) return

    const filter = createFilter(config)
    const lngMap = readLanguagesMap(config)

    compiler.hooks.environment.tap('I18nAutoWebpackPlugin', () => {
      let rules = compiler.options?.module?.rules

      if (!isHasLoader(rules)) {
        const options = { config, lngMap, filter }
        compiler.options.module.rules.push({
          enforce: 'post',
          test: new RegExp(config.test),
          use: [{ loader: I18nAutoWebpackPlugin.loader, options }],
        })
      }
    })
  }
}

export default I18nAutoWebpackPlugin
