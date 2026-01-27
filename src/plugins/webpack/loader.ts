import { LoaderContext } from 'webpack'
import { createFilter } from '../../utils'
import { Configuration } from '../../types'
import { I18nPlugin } from '../core'

export default function i18nAutoLoader(
  this: LoaderContext<{
    config: Configuration
    lngMap: Record<string, string>
    filter: ReturnType<typeof createFilter>
  }>,
  source: string,
  map?: string,
  meta?: any,
) {
  const id = this.resourcePath
  const options = this.getOptions()
  if (!options.filter?.(id)) return source
  const warnText: string[] = []
  const res = I18nPlugin({
    filePath: id,
    code: source,
    config: options.config,
    lngMap: options.lngMap,
    emitWarning: ({ text }) => warnText.push(text),
  })

  if (warnText.length) {
    this.emitWarning(
      new Error(
        `在语料库中未发现该文本【${warnText.join('、')}】请更新语料库`,
      ),
    )
  }

  if (res && res.code) {
    this.callback(null, res.code, map || res.map, meta)
    return
  }

  this.callback(null, source, map, meta)
}
