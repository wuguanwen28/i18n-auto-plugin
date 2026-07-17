import { Configuration } from '../types'
import { addNamed } from '@babel/helper-module-imports'
import * as t from '@babel/types'
import {
  isAllowTranslate,
  parseAst,
  resolveGenerator,
  resolveTraverse,
} from '../utils/parse'
import { getHash } from '../utils'
import { logger } from '../utils/logger'
import { DEFAULT_EXCLUDE_CALL, tplRegexp } from '../utils/config'

const traverse = resolveTraverse()
const generator = resolveGenerator()

type IsHasLngOptions = {
  id: string
  value: string
  loc?: t.SourceLocation | null
}

/**
 * babel AST 转换：把 JS/TS/JSX 源码中已收录进语料库的中文字符串
 * 替换为 _i18n(hash) 调用，并自动注入 import。
 * 被 unplugin（js/ts/jsx/tsx 文件）与 vue-sfc（script 块）共用。
 */
export const transformWithBabel = (params: {
  code: string
  filePath: string
  config: Configuration
  emitWarning: (options: {
    text: string
    id: string
    line: number
    column: number
  }) => void
  lngMap: { [id: string]: any }
}) => {
  try {
    const { code, filePath, config, emitWarning, lngMap } = params

    const { source, imported, local } = {
      source: __NAME__,
      imported: 'i18n',
      local: '_i18n',
      ...(config.importInfo || {}),
    }

    const ast = parseAst(filePath, code)
    if (!ast) return

    const excludeCall = [
      ...DEFAULT_EXCLUDE_CALL,
      ...(config?.excludeCall || []),
    ]

    const isHasLng = ({ id, value, loc }: IsHasLngOptions) => {
      const hasLng = lngMap[id]
      if (!hasLng && config.emitWarn) {
        emitWarning({
          text: value,
          id: filePath,
          line: loc?.start.line || 0,
          column: loc?.start.column || 0,
        })
      }
      return Boolean(hasLng)
    }

    const getCallExpression = (id: string, params?: t.Expression[]) => {
      return t.callExpression(t.identifier(local), [
        t.stringLiteral(id),
        ...(params || []),
      ])
    }

    let needI18n = false

    traverse(ast, {
      JSXText: function (path) {
        if (!isAllowTranslate(path, excludeCall)) return
        const origininalValue = path.node.value
        const trimmedValue = origininalValue.trim()
        const id = getHash(trimmedValue)
        if (!isHasLng({ id, value: trimmedValue, loc: path.node.loc })) return
        const startIndex = origininalValue.indexOf(trimmedValue)
        const lastIndex = startIndex + trimmedValue.length
        const spacesLeft = origininalValue.substring(0, startIndex)
        const spacesRight = origininalValue.substring(lastIndex)

        path.replaceWithMultiple([
          t.jsxText(spacesLeft),
          t.jsxExpressionContainer(getCallExpression(id)),
          t.jsxText(spacesRight),
        ])
        needI18n = true
      },
      StringLiteral: function (path) {
        if (!isAllowTranslate(path, excludeCall)) return
        const value = path.node.value.toString()
        const id = getHash(value)
        if (!isHasLng({ id, value, loc: path.node.loc })) return
        needI18n = true
        const callExpression = getCallExpression(id)
        if (t.isJSXAttribute(path.parent)) {
          path.replaceWith(t.jsxExpressionContainer(callExpression))
        } else {
          path.replaceWith(callExpression)
        }
      },
      TemplateLiteral: function (path) {
        if (!isAllowTranslate(path, excludeCall)) return
        let i = 0
        const value = path
          .toString()
          .replace(/^`|`$/g, '')
          .replace(tplRegexp, () => `{{@${++i}}}`)
        const id = getHash(value)
        if (!isHasLng({ id, value, loc: path.node.loc })) return

        needI18n = true
        const objectExpression = t.objectExpression(
          path.node.expressions.map((item, index) => {
            return t.objectProperty(
              t.stringLiteral(`@${index + 1}`),
              item as any,
            )
          }),
        )
        path.replaceWith(getCallExpression(id, [objectExpression]))
      },
      // 增加导入翻译函数
      Program: {
        exit(path) {
          // 如果需要国际化
          if (needI18n) {
            let isAddImport = true
            path.traverse({
              ImportDeclaration(importPath) {
                if (importPath.node.source.value.includes(source)) {
                  let specifiers = importPath.node.specifiers
                  if (specifiers.length > 0) {
                    let registerLocaleIndex = specifiers.findIndex(
                      (n) => n.local.name === local,
                    )
                    isAddImport = registerLocaleIndex === -1
                  }
                }
              },
            })
            if (isAddImport) {
              addNamed(path, imported, source, {
                importPosition: 'after',
                nameHint: local,
              })
            }
          }
        },
      },
    })

    if (needI18n) {
      let codeRes = generator(
        ast,
        {
          retainLines: true,
          jsescOption: { minimal: true },
          decoratorsBeforeExport: true,
          sourceMaps: true,
          sourceFileName: filePath,
        },
        code,
      )

      return {
        code: codeRes.code,
        map: codeRes.map,
      }
    }
  } catch (error) {
    // 转换失败意味着该文件所有翻译丢失，必须显式告警而非静默吞掉
    logger.error(`i18n转换失败，该文件翻译未生效(${params.filePath}):`, error as Error)
  }
}
