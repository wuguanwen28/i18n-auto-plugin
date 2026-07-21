import MagicString from 'magic-string'
import { parse as parseSFC } from '@vue/compiler-sfc'
import { transformWithBabel } from './babel-transform'
import { getHash } from '../utils'
import { ZH_EXT } from '../utils/config'
import { logger } from '../utils/logger'
import { Configuration } from '../types'

type RewriteOptions = {
  filePath: string
  config: Configuration
  lngMap: { [id: string]: any }
  importInfo: { source: string; imported: string; local: string }
  emitWarning: (options: {
    text: string
    id: string
    line: number
    column: number
  }) => void
}

// @vue/compiler-core NodeTypes（只用到的几个）
const NodeTypes = {
  ELEMENT: 1,
  TEXT: 2,
  ATTRIBUTE: 6,
} as const

type TemplateTextHandlers = {
  /** 含中文的文本节点，text 已 trim */
  onText: (text: string, node: any) => void
  /** 含中文的静态属性（title="中文"），value 为原始属性值 */
  onAttribute: (value: string, prop: any, node: any) => void
}

/**
 * 遍历 template AST 中所有含中文的文本节点与静态属性。
 * 扫描（CLI）与转换（插件）共用此 walker，
 * 保证两侧文本规范化一致 → hash 一致（关键不变量）。
 */
export function walkVueTemplate(node: any, handlers: TemplateTextHandlers) {
  if (!node) return
  if (node.type === NodeTypes.TEXT && ZH_EXT.test(node.content)) {
    const trimmed = node.content.trim()
    if (trimmed) handlers.onText(trimmed, node)
  }
  if (node.type === NodeTypes.ELEMENT && Array.isArray(node.props)) {
    for (const prop of node.props) {
      if (
        prop.type === NodeTypes.ATTRIBUTE &&
        prop.value?.content &&
        ZH_EXT.test(prop.value.content)
      ) {
        handlers.onAttribute(prop.value.content, prop, node)
      }
    }
  }
  if (Array.isArray(node.children)) node.children.forEach(walkChild)
  function walkChild(child: any) {
    walkVueTemplate(child, handlers)
  }
}

/**
 * 【扫描用】从 SFC 源码提取所有待翻译文本与 script 块内容。
 * CLI 的 Translate 用它替代旧的 vueSfcToTsx（编译 template）方案。
 */
export function extractVueSfc(code: string, filePath: string) {
  const texts: string[] = []
  const scripts: string[] = []
  try {
    const { descriptor } = parseSFC(code, {
      filename: filePath,
      sourceMap: false,
    })
    if (descriptor.template?.ast) {
      walkVueTemplate(descriptor.template.ast, {
        onText: (text) => texts.push(text),
        onAttribute: (value) => texts.push(value),
      })
    }
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (block?.content) scripts.push(block.content)
    }
  } catch (error) {
    logger.error(`extractVueSfc error(${filePath}):`, error as Error)
  }
  return { texts, scripts }
}

/**
 * 【转换用】在 SFC 源码层做 i18n 改写（框架编译器之前）：
 *
 * 1. template 含中文的文本节点 → {{ _i18n('hash') }} 插值；
 *    静态属性 title="中文" → 动态绑定 :title="_i18n('hash')"。
 *    改写后中文以表达式形式进入框架编译器，uni-app 等多产物
 *    编译器会把它编进 JS 逻辑层，而不是静态文本直落 wxml
 *    （修复小程序端模板中文不转换的 bug）。
 * 2. script/scriptSetup 块 → 走既有 babel 转换（transformWithBabel）。
 * 3. 模板插值引用 _i18n 需要 script 侧提供绑定：
 *    无 scriptSetup 时追加一个只含 import 的 <script setup> 块
 *    （SFC 允许 script 与 script setup 并存）。
 *
 * 已知限制：模板内的 JS 表达式（{{ '中文' }}、:label="'中文'"）
 * 暂不处理——扫描与转换两侧一致跳过，不会产生 hash 不一致。
 */
export function rewriteVueSfc(code: string, options: RewriteOptions) {
  const { filePath, config, lngMap, importInfo, emitWarning } = options
  try {
    const { descriptor } = parseSFC(code, {
      filename: filePath,
      sourceMap: false,
    })

    const s = new MagicString(code)
    let templateReplaced = 0
    let scriptReplaced = false

    // 未收录语料时告警并跳过，与 babel 侧行为一致
    const isHasLng = (text: string, loc: any) => {
      const id = getHash(text)
      if (lngMap[id]) return id
      emitWarning({
        text,
        id: filePath,
        line: loc?.start.line || 0,
        column: loc?.start.column || 0,
      })
      return null
    }

    // ---- 1) template 改写 ----
    if (descriptor.template?.ast) {
      walkVueTemplate(descriptor.template.ast, {
        onText: (trimmed, node) => {
          const id = isHasLng(trimmed, node.loc)
          if (!id) return
          // 只替换文本本身，保留首尾空白
          const startIndex = node.content.indexOf(trimmed)
          const start = node.loc.start.offset + startIndex
          s.overwrite(
            start,
            start + trimmed.length,
            `{{ ${importInfo.local}('${id}') }}`,
          )
          templateReplaced++
        },
        onAttribute: (value, prop) => {
          const id = isHasLng(value, prop.loc)
          if (!id) return
          s.overwrite(
            prop.loc.start.offset,
            prop.loc.end.offset,
            `:${prop.name}="${importInfo.local}('${id}')"`,
          )
          templateReplaced++
        },
      })
    }

    // ---- 2) script / scriptSetup 走 babel 转换 ----
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (!block?.content) continue
      const res = transformWithBabel({
        code: block.content,
        filePath,
        config,
        lngMap,
        emitWarning,
      })
      if (res?.code) {
        s.overwrite(block.loc.start.offset, block.loc.end.offset, res.code)
        scriptReplaced = true
      }
    }

    if (!templateReplaced && !scriptReplaced) return

    // ---- 3) 确保模板插值能解析到 _i18n ----
    if (templateReplaced) {
      const importCode = `import { ${importInfo.imported} as ${importInfo.local} } from '${importInfo.source}'`
      const setupBlock = descriptor.scriptSetup
      if (setupBlock) {
        // script 若已被 babel 转换注入过 _i18n（引号风格不定），按 local 名检查
        const finalSetup = scriptReplaced ? s.toString() : setupBlock.content
        if (!finalSetup.includes(importInfo.local)) {
          s.appendRight(setupBlock.loc.start.offset, `\n${importCode}\n`)
        }
      } else {
        s.prepend(`<script setup>\n${importCode}\n</script>\n`)
      }
    }

    return {
      code: s.toString(),
      map: s.generateMap({ hires: true, source: filePath }),
    }
  } catch (error) {
    logger.error(`rewriteVueSfc error(${filePath}):`, error as Error)
  }
}
