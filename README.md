# i18n-auto-plugin

自动国际化工具:扫描项目中的中文文本,通过翻译 API 生成多语言包,构建时将中文字符串替换为 `_i18n(hash)` 调用。支持 Vue3/React + Vite/Webpack/Rspack/Rolldown。

## 特性

- 🔍 **自动扫描中文**:代码里的中文字符串、JSX 文本、模板字符串,以及 Vue `<template>` 里的文本与属性
- 🌐 **多翻译服务**:百度、百度大模型、有道、有道大模型、Google、自定义翻译函数
- 📦 **多构建工具**:Vite / Webpack / Rspack / Rolldown(基于 unplugin 统一实现)
- 🎯 **Vue SFC 源码级改写**:template 文本 → `{{ _i18n(hash) }}` 插值,兼容 uni-app 小程序
- 🔀 **多服务对比翻译**:多服务并行翻译,差异生成 `diff.json`,人工选定后 `apply` 应用
- 🩺 **语料体检**:`check` 检测死键、缺失翻译、覆盖率,`prune` 清理无用的死键
- 📊 **CSV 导入导出**:导出语言包给翻译人员校对,改完导回(支持 Excel 编辑)
- 🌍 **自定义语言**:内置 16 种常用语种,可通过 `langMap` 扩展任意语种
- 💾 **文件级缓存**:扫描结果按 mtime + 内容 hash 缓存,增量扫描
- 🔧 **配置继承**:monorepo 子包可 `extends` 根配置
- 🔁 **QPS 限流 + 失败重试**:避免触发翻译服务频率限制,失败自动指数退避重试

## 安装

```bash
pnpm add i18n-auto-plugin -D
# 或 npm install i18n-auto-plugin -D
```

> Node >= 20.19 / 22.12(CJS 产物通过 require(esm) 加载 unplugin)

## 快速开始

### 1. 初始化配置

```bash
npx i18n init
```

生成 `i18n.config.js`,填入翻译服务的 appId/appKey:

```js
/** @type {import('i18n-auto-plugin').I18nConfig} */
module.exports = {
  entry: './src',
  output: { dir: './src/locale', splitLngFile: false },
  originLang: 'zh-CN',
  languages: ['en-US', 'ja-JP'],
  translateService: 'baidu',
  baidu: { appId: '你的appId', appKey: '你的appKey' },
}
```

### 2. 扫描 + 翻译

```bash
npx i18n
```

扫描 `entry` 下的中文 → 调用翻译服务 → 生成语言包到 `output.dir` → 生成注册文件 `locale/index.js`。

### 3. 接入构建插件

**Vite**(`vite.config.ts`):
```ts
import { I18nAutoPlugin } from 'i18n-auto-plugin/vite'
export default {
  plugins: [I18nAutoPlugin(), vue()],
}
```

**Webpack**(`webpack.config.js`):
```js
const { I18nAutoPlugin } = require('i18n-auto-plugin/webpack')
module.exports = {
  plugins: [new I18nAutoPlugin()],
}
```

**Rspack**(`rspack.config.js`):
```js
const { I18nAutoPlugin } = require('i18n-auto-plugin/rspack')
module.exports = {
  plugins: [new I18nAutoPlugin()],
}
```

**Rolldown**(`rolldown.config.ts`):
```ts
import { I18nAutoPlugin } from 'i18n-auto-plugin/rolldown'
export default {
  plugins: [I18nAutoPlugin()],
}
```

构建时,源码中的中文会被替换为 `_i18n('hash')` 调用。

### 4. 运行时引入语言包

入口文件(如 `main.ts`):
```ts
import './locale'  // 注册文件自动 extendLocale(lngMap)
```

### 5. 切换语言

```ts
import { changeLanguage } from 'i18n-auto-plugin'
changeLanguage('en-US')  // 默认刷新页面,加载新语言
```

## CLI 命令

| 命令 | 说明 |
|---|---|
| `npx i18n init` | 初始化 `i18n.config.js`(`-f` 强制覆盖) |
| `npx i18n` / `npx i18n translate` | 扫描 + 翻译 + 生成语言包与注册文件 |
| `npx i18n scan` | 只扫描写语料,不调用翻译服务 |
| `npx i18n apply` | 应用 `diff.json` 中修改后的 suggested 到语言包 |
| `npx i18n check` | 语料体检:检测死键、缺失翻译、翻译覆盖率(只读) |
| `npx i18n prune` | 清理死键(代码里已删除但语言包仍残留的文案) |
| `npx i18n export` | 导出语言包为 CSV,交给翻译人员校对(`--missing` 只导缺失行) |
| `npx i18n import <file>` | 从 CSV 写回语言包(默认覆盖,`--fill-only` 只填空白) |

通用选项:
- `-c, --config <file>`:指定配置文件
- `--no-cache`:忽略缓存重新扫描
- `--logger <level>`:日志级别 `none | error | warn | info`
- `-f, --force`:`translate` 命令强制重新翻译已翻译的文本

## 配置说明

`i18n.config.js` 字段:

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `extends` | string | - | 继承另一个配置文件(相对当前文件目录解析,深合并) |
| `entry` | string \| string[] | `'./src'` | 扫描入口(相对 `process.cwd()`) |
| `output.dir` | string | `'./src/locale'` | 语言包输出目录 |
| `output.lngFile` | string | `'index.json'` | 单文件格式的语言包文件名(`splitLngFile: false`) |
| `output.splitLngFile` | boolean | `false` | true:每个语种一个文件(`en-US.json` 等) |
| `output.registerFile` | boolean \| string | `true` | 是否生成注册文件(加载语言包 + extendLocale) |
| `output.diffFile` | string | `'diff.json'` | 多服务对比差异报告文件名 |
| `importInfo` | object | 见下 | 构建期注入的 import 信息 |
| `test` | RegExp \| string | `'.*(js\|jsx\|ts\|tsx\|vue)$'` | 扫描的文件扩展名 |
| `include` | string \| string[] | `['src']` | 包含目录 |
| `exclude` | string \| string[] | `['node_modules']` | 排除目录 |
| `excludeCall` | string[] | `['i18n','console.log','console.warn','console.error']` | 跳过这些函数的参数翻译 |
| `originLang` | LngType | `'zh-CN'` | 原始语言(源语言,暂只支持中文) |
| `languages` | LngType[] | `['en-US']` | 目标语言(内置 16 种,可自定义) |
| `batchSize` | number | `100` | 翻译批次大小 |
| `langMap` | object | - | 自定义语种到各翻译服务 API 代码的映射(见下) |
| `retryTimes` | number | `3` | 翻译失败重试次数(指数退避 1s/2s/4s) |
| `qps` | number | `0` | 每秒请求数限流(0 表示不限) |
| `forceTranslate` | boolean | `false` | 强制重新翻译已翻译的文本 |
| `cache` | boolean | `true` | 扫描缓存(按 mtime + 内容 hash) |
| `logger` | LoggerLevel | `'info'` | 日志级别 |
| `emitWarn` | boolean | `true` | 构建时语料库未收录文本是否告警 |
| `translateService` | string \| string[] | `'baidu'` | 翻译服务(数组则对比模式) |
| `capitalize` | boolean \| LngType[] | `false` | 译文每行首字母大写(跳过开头占位符/数字);`true` 全语种,数组指定语种 |
| `formatTranslatedText` | function | - | 译文后处理钩子,落盘前调用(见[译文后处理](#译文后处理)) |

**内置语种**(16 种):`zh-CN` `zh-TW` `en-US` `ja-JP` `ko-KR` `fr-FR` `de-DE` `es-ES` `ru-RU` `ar-SA` `pt-BR` `it-IT` `th-TH` `vi-VN` `nl-NL` `pl-PL`

**自定义语种**:不在内置列表的语种(如 `fr-CA`),通过 `langMap` 配置各翻译服务的 API 代码:
```js
langMap: {
  'fr-CA': { baidu: 'fra', youdao: 'fr', google: 'fr' }
}
```
按服务族(`baidu`/`youdao`/`google`)查表:百度系(baidu/baiduAi)共用 `baidu`,有道系(youdao/youdaoAi)共用 `youdao`。不配映射的自定义语种翻译时会报错(避免静默翻成英语)。

`importInfo` 默认:
```js
{ source: 'i18n-auto-plugin', imported: 'i18n', local: '_i18n' }
```
构建期会把 `_i18n('hash')` 注入为 `import { i18n as _i18n } from 'i18n-auto-plugin'`。

## 翻译服务配置

### 百度翻译(`baidu`)

文档:https://fanyi-api.baidu.com/doc/23

```js
baidu: { appId: 'xxx', appKey: 'xxx', needIntervene: 0 }
```

### 百度大模型(`baiduAi`)

文档:https://fanyi-api.baidu.com/doc/21

```js
baiduAi: {
  appId: 'xxx',
  apiKey: 'xxx',  // 或 appKey 签名鉴权
  model_type: 'llm',  // llm 大模型(默认) | nmt 机器翻译
  reference: '使用学术风格翻译',  // 自定义指令
}
```

### 有道翻译(`youdao`)

文档:https://ai.youdao.com/DOCSIRMA/html/trans/api/plwbfy/

```js
youdao: { appId: 'xxx', appKey: 'xxx' }
```

### 有道大模型(`youdaoAi`)

文档:https://ai.youdao.com/DOCSIRMA/html/trans/api/dmxfy/

```js
youdaoAi: {
  appId: 'xxx', appKey: 'xxx',
  handleOption: 0,  // 0 子曰 pro(14B) | 3 lite(1.5B)
  prompt: '使用学术风格翻译',
  vocabId: '术语表ID',
}
```

### Google(`google`)

文档:https://cloud.google.com/translate/docs/reference/rest/v2/translate

```js
google: { apiKey: 'xxx', proxy: 'http://...' }
```

### 自定义(`custom`)
```js
CustomTranslate: async (texts, fromLang, toLang) => {
  // texts: { [id]: 中文文本 }
  // 返回 { [id]: 译文 }
  const result = {}
  for (const id in texts) {
    result[id] = await myTranslate(texts[id], toLang)
  }
  return result
}
```

## 译文后处理

翻译服务返回的译文大小写可能不一致(如百度对句首字母大写,但占位符/数字开头的文本无法大写),可通过以下两个配置项统一处理。落盘前执行顺序:`reFormatText`(还原换行/占位符) -> `capitalize` -> `formatTranslatedText`。

### `capitalize`(内置首字母大写)

整条译文每行首字母大写(sentence case),跳过行首的占位符 `{{@N}}`、数字、标点。

```js
// 所有目标语种生效(中日韩阿拉伯等无大小写语种为 no-op,安全)
capitalize: true

// 或只对指定语种
capitalize: ['en-US']
```

> ⚠️ 会破坏 `iPhone`、`GitHub` 等首字母小写的专有名词(如 `iPhone` -> `IPhone`)。需要保护时用下面的 `formatTranslatedText` 钩子做白名单。

### `formatTranslatedText`(自定义后处理钩子)

在 `capitalize` 之后调用,可覆盖其结果。入参 `(text, ctx)`,`ctx = { id, fromLang, toLang, origin }`(`origin` 为原始中文原文),返回处理后的文本(支持 `Promise`,便于调外部校对 API);返回空串/`undefined` 时保留当前译文。

```js
formatTranslatedText: (text, { toLang, origin }) => {
  if (toLang !== 'en-US') return text
  // 白名单:原文命中以下词时跳过大写,保护 iPhone 等
  const keepList = ['iPhone', 'GitHub', 'iOS']
  if (keepList.some((w) => origin.includes(w))) return text
  return text
}
```

## 多服务对比翻译 + apply

配置多个翻译服务:
```js
translateService: ['baidu', 'youdao'],
baidu: { appId: '...', appKey: '...' },
youdao: { appId: '...', appKey: '...' },
```

`npx i18n` 时,每个文本用所有服务并行翻译,生成 `diff.json`:
```json
{
  "en-US": [
    {
      "text": "首页",
      "id": "abc123def456789",
      "translations": { "baidu": "Home", "youdao": "Homepage" },
      "suggested": "Home",
      "consensus": false
    }
  ]
}
```

人工修改 `diff.json` 的 `suggested`(选定译文),然后:
```bash
npx i18n apply
```
把修改写回语言包,无需逐个查 hash。

> `diff.json` 含未应用的修改时,再次 `npx i18n` 会询问是否覆盖(避免丢失修改)。

## 运行时 API

```ts
import { i18n, extendLocale, changeLanguage, getCurrentLng } from 'i18n-auto-plugin'
```

- `i18n(hash, data?)`:翻译函数,`data` 用于插值(`{{key}}`)
- `extendLocale(lngMap)`:注册语言包数据(接收 `{ 语种: { id: 文本 } }` 格式)
- `toByLocale(map)`:把 `{ id: { 语种: 文本 } }` 转成上面那种(单文件语言包手动注册时用)
- `changeLanguage(lng, autoLoad = true)`:切换语言,默认刷新页面
- `getCurrentLng()`:获取当前语言

插值示例:
```ts
// 源码:`测试模板：你好${name}`  →  hash + 占位符 {{@1}}
// 运行时:i18n('hash', { '@1': name })
```

语言包格式:
- `splitLngFile: false`:`{ [id]: { [lng]: text } }`(单文件,注册文件自动用 `toByLocale` 转换后注入)
- `splitLngFile: true`:`{ [lng]: { [id]: text } }`(分文件,直接注入)

## 注意事项

- **Vue2 不支持**:依赖 `@vue/compiler-sfc`(Vue3),且注入 `<script setup>` 块 Vue2 无法消费。
- **webpack + thread-loader**:unplugin loader 与 thread-loader 序列化冲突(Compiler 循环引用),vue-cli 需 `parallel: false`。Rspack 内置多线程,无此问题。
- **扫描与转换一致**:CLI 扫描与构建插件转换共用同一套 babel visitor + Vue template walker,保证 hash 一致。模板内 JS 表达式(`{{ '中文' }}`、`:label="'中文'"`)两侧一致跳过。
- **缓存**:扫描缓存位于 `node_modules/.cache/i18n-auto-plugin`,源文件 mtime/内容变化自动失效。修改 `excludeCall`/`test` 等配置也会失效。
- **新增语言**:内置 16 种常用语种(见配置说明)。其他语种通过 `langMap` 配置即可,无需改源码。

## License

MIT
