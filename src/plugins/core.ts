import { Configuration, LanguagesMap } from '../types'
import { addNamed } from '@babel/helper-module-imports'
import * as t from '@babel/types'
import {
  DEFAULT_EXCLUDE_CALL,
  getHash,
  isAllowTranslate,
  parseAst,
  resolveGenerator,
  resolveTraverse,
  sliceText,
  tplRegexp,
} from '../utils'
import chalk from 'chalk'

const traverse = resolveTraverse()
const generator = resolveGenerator()

type IsHasLngOptions = {
  id: string
  value: string
  loc?: t.SourceLocation | null
}

export const I18nPlugin = (params: {
  code: string
  filePath: string
  config: Configuration
  emitWarning: (
    log: string,
    pos?: number | { column: number; line: number },
  ) => void
  lngMap: LanguagesMap | { [id: string]: string }
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
      const content = `在语言包中未发现以下字段【${chalk.blue(sliceText(value))}】请更新语言包`
      if (!hasLng && config.warn) {
        const pos = loc
          ? { line: loc?.start.line || 0, column: loc?.start.column || 0 }
          : undefined

        emitWarning(content, pos)
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
    console.log('error ==> ', error)
  }
}
