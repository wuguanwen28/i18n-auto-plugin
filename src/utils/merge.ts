/** 判断是否为纯对象(排除数组、RegExp、函数、null、类实例等) */
export const isPlainObject = (value: any): value is Record<string, any> => {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

/**
 * 深合并配置:仅当父子值均为纯对象时递归合并,
 * 其余情况(数组、字符串、RegExp、函数、类型不一致)子值整体覆盖,
 * 子级未声明的字段继承父级
 */
export const deepMerge = <T extends Record<string, any>>(
  parent: T,
  child: Record<string, any>,
): T => {
  const result: Record<string, any> = { ...parent }
  for (const key of Object.keys(child)) {
    const parentValue = result[key]
    const childValue = child[key]
    result[key] =
      isPlainObject(parentValue) && isPlainObject(childValue)
        ? deepMerge(parentValue, childValue)
        : childValue
  }
  return result as T
}
