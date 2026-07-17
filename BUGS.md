# 已知 Bug 清单（2026-07-17 全量扫描）

> 扫描范围：`src/` 全部源码 + `rolldown.config.ts` + `package.json` exports + 构建产物验证。
> 标注 ✅ 的表示已实际运行验证过，非推测。

## 🔴 严重

### 1. ESM 版 webpack 插件加载即崩溃 ✅ 【已修复：迁移 unplugin 后 loader 由 unplugin 管理】
- **位置**：`src/plugins/webpack/plugin.ts:14` + `rolldown.config.ts`
- **现象**：`import 'i18n-auto-plugin/webpack'`（webpack.config.mjs / `"type": "module"` 项目）直接抛 `Cannot find module './webpack-loader.cjs'`
- **原因**：`static loader = require.resolve('./webpack-loader.cjs')` 是类静态字段，import 时立即求值；但 rolldown 只把 webpack-loader 输出到 `dist/cjs/`，ESM 产物 `dist/webpack-plugin.js` 同目录下没有该文件
- **影响面**：仅 ESM 方式使用 webpack 插件的用户；CJS `require` 用户不受影响
- **修复方向**：打包系统重构中解决（loader 与插件产物同目录，或惰性 getter + 路径回退）

### 2. `getOldLanguagesMap` 对象字面量键写错 ✅【已修复：`{ [lng]: content }`，splitLngFile 模式实测旧翻译不再丢失】
- **位置**：`src/commands/Translate.ts:93`
- **现象**：`this.mergeLanguagesMap({ lng: content })` —— 键是字符串 `"lng"`，不是变量插值
- **后果**：`splitLngFile: true` 模式下旧翻译全部加载失败 → 每次全量重新翻译（浪费 API 费用）；且语料库中产生 id 为 `"lng"` 的垃圾条目
- **修复**：改为 `{ [lng]: content }`

### 3. StringLiteral 替换命中非法 AST 位置 → 整文件翻译静默失效 ✅
- **位置**：`src/utils/parse.ts:125`（`isAllowTranslate`）+ `src/plugins/core.ts`
- **现象**：源码中存在 `const obj = { "中文键": 1 }` 这类**对象属性键为中文**的写法时，`path.replaceWith(callExpression)` 抛 `TypeError: Property key of ObjectProperty expected node to be of a type [...] but instead got "CallExpression"`
- **后果**：`core.ts:175` 外层 try/catch 吞掉异常，仅 `console.log`，该文件**所有**翻译静默丢失，页面显示原始中文，极难排查
- **修复方向**：`isAllowTranslate` 排除非 computed 的 `ObjectProperty.key`、`ImportDeclaration.source`、`ExportDeclaration.source`、`TSEnumMember` 等位置；或对象键改用 computed key 替换

### 4. Google / Youdao / Custom 翻译器是空壳，且污染语料库
- **位置**：`src/translators/GoogleTranslator.ts`、`YoudaoTranslator.ts`、`CustomTranslator.ts`
- **现象**：三者 `requestTranslate` 均为 `return texts`，把中文原文当译文返回
- **后果**：原文被写入目标语言字段并落盘；下次运行 `splitText` 检测到 `item[toLang]` 已存在会**永久跳过**，之后接入真服务也不会重翻
- **附带**：`I18nConfig.CustomTranslate` 配置项（types/index.d.ts:243）定义了但 `CustomTranslator` 从未调用，是死配置。README 声称支持有道/自定义翻译与实际不符
- **修复方向**：CustomTranslator 调用 `config.CustomTranslate`；Google/Youdao 未实现前应直接 throw 而非静默返回原文

### 5. SSR / Node 环境 import 运行时包即崩溃
- **位置**：`src/index.ts:26` + `src/index.ts:134`
- **现象**：`storage: window?.localStorage` —— 可选链不能保护未声明的标识符；模块顶层 `new I18nManager()` 使得 Node/SSR（Nuxt、Next、vitest）中 import 即抛 `ReferenceError: window is not defined`
- **修复**：`typeof window !== 'undefined' ? window.localStorage : undefined`；同理 `changeLanguage` 里的 `window.location.reload()` 也需守卫

## 🟡 中等

### 6. webpack 插件 `isHasLoader` 假设 `rule.use` 为数组 【已修复：迁移 unplugin 后该代码已删除】
- **位置**：`src/plugins/webpack/plugin.ts:20`
- **现象**：遇到 `use: 'babel-loader'`（字符串写法）时 `rule?.use?.some` 调用 undefined → TypeError，构建崩溃
- **修复**：加 `Array.isArray(rule.use)` 判断

### 7. 缓存不感知配置变化
- **位置**：`src/utils/ceche.ts`
- **现象**：缓存键只含文件内容 hash + mtime；修改 `excludeCall` / `test` 等配置后仍返回旧扫描结果，需手删 `node_modules/.cache/i18n-auto-plugin`
- **修复**：把配置指纹掺入缓存 hash 或 CACHE_VERSION

### 8. `tplRegexp` 不处理嵌套花括号
- **位置**：`src/utils/config.ts:42`
- **现象**：`` `你好${fn({a:1})}` `` 惰性匹配在第一个 `}` 截断，译文残留 `)}` 垃圾字符（扫描/转换两侧一致所以 hash 能对上，但文案是坏的）

### 9. `init` 生成的配置在 CJS 项目下加载失败
- **位置**：`src/commands/InitConfig.ts` + `src/utils/index.ts`（`getExportPrefix`）
- **现象**：对 `.js` 固定生成 `export default`，项目无 `"type": "module"` 时 cosmiconfig require 加载报 SyntaxError
- **修复**：init 时探测项目 package.json 的 type 决定生成 ESM 还是 `module.exports`

### 10. 百度术语干预参数名存疑
- **位置**：`src/translators/BaiduTranslator.ts`（`needIntervene` 直接进请求体）
- **说明**：百度通用翻译 API 的术语干预参数官方文档为 `action`，`needIntervene` 大概率不生效，需对照文档确认

## 🟢 轻微

- `src/plugins/core.ts:135`：已有 import 判断用 `source.value.includes(source)` 子串匹配，`"xxx-i18n-auto-plugin-fork"` 会被误判
- `src/index.ts:61`：`_format` 插值 key 缺失时输出字符串 `"undefined"`
- `src/types/index.d.ts:176`：注释说 `emitWarn` 默认 `true`，实际 `DEFAULT_CONFIG` 为 `false`
- `src/utils/logger.ts`：info/warn/error 三个级别全部走 `console.warn`
- `src/plugins/core.ts:176`：出错仅 `console.log('error ==> ')`，未走 logger、未带文件名
- `src/utils/ceche.ts`：文件名拼写 `ceche` → 应为 `cache`

## 🔒 安全

- `examples/react-vite/i18n.config.js` 提交了真实的百度 `appId`/`appKey` 明文且已推送到公开 GitHub 仓库 —— **需尽快到百度翻译控制台重置密钥**，示例中改为占位符
