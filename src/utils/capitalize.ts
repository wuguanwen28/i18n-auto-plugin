import { LngType } from '../types'

/**
 * 整条译文每行首字母大写(sentence case)
 * 跳过行首的占位符 {{@N}}、数字、标点、空白,大写每行第一个英文字母
 * 注意:会破坏 iPhone 等首字母小写的专有名词,需配合 formatTranslatedText 钩子做白名单
 * @param text 译文(reFormatText 已还原换行符、规范化占位符)
 * @returns 每行首字母大写后的文本
 */
export const capitalizeFirst = (text: string): string =>
  text.replace(
    /(^|\n)([^a-zA-Z\n]*)([a-zA-Z])/g,
    (_, lb: string, pre: string, c: string) => lb + pre + c.toUpperCase(),
  )

/**
 * 判断目标语种是否在 capitalize 生效范围内
 * - true:对所有语种生效(无大小写语种为 no-op,安全)
 * - LngType[]:只对指定语种
 * - false/undefined:不生效
 * @param capitalize 配置项 capitalize 的值
 * @param toLang 当前目标语种
 * @returns 是否对该语种执行首字母大写
 */
export const shouldCapitalize = (
  capitalize: boolean | LngType[] | undefined,
  toLang: string,
): boolean => {
  if (!capitalize) return false
  return capitalize === true || capitalize.includes(toLang as LngType)
}
