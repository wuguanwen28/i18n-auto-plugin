import { TranslateServiceType } from '../types'

/**
 * 比对同一原文的多个服务译文,判定多数一致与建议值
 * @param translations 各服务译文,key 为服务名;译文中空值/undefined 不参与统计
 * @param primaryService 全不同时取值的首选服务(translateService 数组第一个)
 */
export const compareTranslations = (
  translations: Partial<Record<string, string>>,
  primaryService: string,
): { suggested: string; consensus: boolean } => {
  // 统计各译文频次(忽略空值)
  const counts: Record<string, number> = {}
  for (const svc in translations) {
    const t = translations[svc]
    if (t) counts[t] = (counts[t] || 0) + 1
  }

  const validCount = Object.keys(counts).length
  // 所有服务译文都为空:suggested 空,consensus false
  if (validCount === 0) return { suggested: '', consensus: false }

  // 取频次最高的译文
  let topText = ''
  let topCount = 0
  for (const text in counts) {
    if (counts[text] > topCount) {
      topText = text
      topCount = counts[text]
    }
  }

  // 频次最高出现 ≥2 次 -> 多数一致;否则全不同,取 primaryService 译文
  if (topCount >= 2) {
    return { suggested: topText, consensus: true }
  }
  const primary = translations[primaryService]
  return { suggested: primary || topText, consensus: false }
}
