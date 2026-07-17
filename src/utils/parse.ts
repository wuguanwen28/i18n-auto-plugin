import fs from 'node:fs'
import * as t from '@babel/types'
import { parse } from '@babel/parser'
import { NodePath } from '@babel/traverse'
import type Traverse from '@babel/traverse'
import type generate from '@babel/generator'
import { createRequire } from 'node:module'

import { logger } from './logger'
import { ZH_EXT } from './config'

const _require = createRequire(import.meta.url)
export const resolveTraverse = (): typeof Traverse => {
  let res = _require('@babel/traverse')
  if (res.default) res = res.default
  return res
}
export const resolveGenerator = (): typeof generate => {
  let res = _require('@babel/generator')
  if (res.default) res = res.default
  return res
}

export const parseAst = (filePath: string, code?: string) => {
  if (!code) {
    if (!fs.existsSync(filePath)) return null
    code = fs.readFileSync(filePath, 'utf-8')
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

/**
 * 该字符串所处的 AST 位置是否禁止替换为 CallExpression。
 * 这些位置的字符串是语法结构的一部分，替换会导致 babel 抛
 * TypeError，进而使整个文件的转换静默失效。
 * 扫描侧同样要跳过，保证扫描/转换两侧文本集合一致。
 */
const isForbiddenPosition = (path: NodePath<t.Node>) => {
  const { parent, node } = path

  // 对象属性键：{ "中文": 1 }（computed 键 { ["中文"]: 1 } 是表达式，可替换）
  if (
    (t.isObjectProperty(parent) || t.isObjectMethod(parent)) &&
    parent.key === node &&
    !parent.computed
  ) {
    return true
  }

  // 类属性/方法键：class A { "中文" = 1 }
  if (
    (t.isClassProperty(parent) || t.isClassMethod(parent)) &&
    parent.key === node &&
    !parent.computed
  ) {
    return true
  }

  // import / export 的模块路径：import x from '中文路径'
  if (
    t.isImportDeclaration(parent) ||
    t.isExportNamedDeclaration(parent) ||
    t.isExportAllDeclaration(parent)
  ) {
    return true
  }

  // import { "中文" as x } 的 imported 位置
  if (t.isImportSpecifier(parent) || t.isExportSpecifier(parent)) {
    return true
  }

  // 枚举成员名：enum E { "中文" = 1 }
  if (t.isTSEnumMember(parent) && parent.id === node) return true

  // JSX 属性名侧不可能是 StringLiteral，无需处理；
  // TS 字面量类型在 isAllowTranslate 已单独排除

  return false
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
  if (t.isTSLiteralType(path.parent)) return false

  // 语法结构位置（对象键、import路径等），替换会产生非法 AST
  if (isForbiddenPosition(path)) return false

  // 调用名在排除列表中
  const callName = getCallName(path.parent)
  if (callName && Array.isArray(excludeCall)) {
    if (excludeCall.includes(callName)) return false
  }

  return true
}
