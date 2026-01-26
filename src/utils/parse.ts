import fs from 'node:fs'
import path from 'node:path'
import * as t from '@babel/types'
import { parse } from '@babel/parser'
import { NodePath } from '@babel/traverse'
import type Traverse from '@babel/traverse'
import type Generator from '@babel/generator'
import { createRequire } from 'node:module'
import { compileTemplate, parse as parseSFC } from '@vue/compiler-sfc'

import { logger } from './logger'
import { ZH_EXT } from './config'

const _require = createRequire(import.meta.url)
export const resolveTraverse = (): typeof Traverse => {
  let res = _require('@babel/traverse')
  if (res.default) res = res.default
  return res
}
export const resolveGenerator = (): Generator => {
  let res = _require('@babel/generator')
  if (res.default) res = res.default
  return res
}

export const parseAst = (filePath: string, code?: string) => {
  const ext = path.extname(filePath)
  if (!code) {
    code = fs.readFileSync(filePath, 'utf-8')
    if (ext === '.vue') code = vueSfcToTsx(code, filePath)
  }

  try {
    const ast = parse(code, {
      sourceType: 'module',
      errorRecovery: true,
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    })

    return ast
  } catch (error) {
    logger.error(`parseAst error:`, error as Error)
    return null
  }
}

export function vueSfcToTsx(code: string, filePath: string) {
  try {
    const { descriptor } = parseSFC(code, {
      filename: filePath,
      sourceMap: false,
    })

    const { template, script, scriptSetup } = descriptor

    let templateContent = ''
    if (template?.content) {
      templateContent = compileTemplate({
        id: `1`,
        scoped: false,
        ast: template.ast,
        filename: filePath,
        source: template.content,
      }).code
    }

    const content = [script?.content, scriptSetup?.content, templateContent]
      .filter(Boolean)
      .join('\n')

    return content || code
  } catch (error) {
    logger.error(`vueSfcToTsx error:`, error as Error)
    return code
  }
}

/**
 * 获取 MemberExpression / CallExpression 的完整调用名
 * a.b.c() => "a.b.c"
 * a['b'].c => "a.b.c"
 * a?.b.c() => "a.b.c"
 */
export function getCallName(node: t.Node): string | null {
  // 兼容 a.b.c()
  if (t.isCallExpression(node)) {
    return getCallName(node.callee)
  }

  // 兼容可选链 a?.b.c()
  if (t.isOptionalCallExpression(node)) {
    return getCallName(node.callee)
  }

  const parts: string[] = []

  let current: t.Node | null = node

  while (
    t.isMemberExpression(current) ||
    t.isOptionalMemberExpression(current)
  ) {
    const prop = current.property

    if (t.isIdentifier(prop)) {
      parts.unshift(prop.name)
    } else if (t.isStringLiteral(prop)) {
      parts.unshift(prop.value)
    } else {
      return null
    }

    current = current.object
  }

  if (t.isIdentifier(current)) {
    parts.unshift(current.name)
    return parts.join('.')
  }

  return null
}

export const isAllowTranslate = (
  path:
    | NodePath<t.JSXText>
    | NodePath<t.StringLiteral>
    | NodePath<t.TemplateLiteral>,
  excludeCall: string[] = [],
) => {
  let text = ''
  if (t.isJSXText(path.node)) {
    text = path.node.value.toString()
  } else if (t.isStringLiteral(path.node)) {
    text = path.node.value.toString()
  } else if (t.isTemplateLiteral(path.node)) {
    text = path.node.quasis.map((item) => item.value.raw).join('')
  }

  // 不是中文
  if (!ZH_EXT.test(text)) return false

  // 父节点是ts字面量类型，不翻译
  if (t.isTSLiteralType(path.parent)) return

  // 调用名在排除列表中
  const callName = getCallName(path.parent)
  if (callName && Array.isArray(excludeCall)) {
    if (excludeCall.includes(callName)) return false
  }

  return true
}
