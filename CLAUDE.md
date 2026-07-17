# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

i18n-auto-plugin 是一个自动国际化工具：扫描项目中的中文文本，通过翻译 API（百度/百度大模型/有道/Google/自定义）生成语言包，并在构建时（Vite/Webpack 插件）将中文字符串替换为 `_i18n(hash)` 调用。支持 Vue3/React 项目。

## Commands

- `pnpm build` — 清空 dist 后用 rolldown 打包（`rolldown -c rolldown.config.ts`）
- `pnpm dev` — 同上但带 `-w` watch 模式
- 无测试框架、无 lint 配置。验证改动的方式是在 `examples/` 下的示例项目（react-vite、react-webpack、vue3、vue3-uniapp）中手动运行。
- CLI 入口：`npx i18n init`（生成 i18n.config.js）、`npx i18n`（扫描 + 翻译）

## Build Setup (rolldown.config.ts)

按运行环境分为三个构建配置：

1. **浏览器运行时**（`src/index.ts` → `dist/index.js`，platform: browser）— 用户页面执行，禁止引入 node 依赖
2. **Node ESM**（bin、vite-plugin、webpack-plugin → `dist/`）
3. **Node CJS**（vite-plugin、webpack-plugin → `dist/cjs/`）

其他要点：
- **插件层基于 unplugin**：`src/plugins/unplugin.ts` 是唯一实现（transformInclude + transform），`vite/plugin.ts` 和 `webpack/plugin.ts` 只是一行封装。webpack 的 loader 注入由 unplugin 内部处理，本包不产出 loader。
- **unplugin 必须保持 external**：它通过 `import.meta.dirname` 定位自身的 loader 文件，打进 bundle 会破坏路径解析。unplugin 为 ESM-only，CJS 产物靠 Node 的 require(esm) 加载它（要求 Node >= 20.19 / 22.12）。
- package.json `exports` 映射 `./vite` 和 `./webpack` 子路径，import/require 双条件。
- `__NAME__` 和 `__VERSION__` 是构建期由 @rollup/plugin-replace 注入的全局占位符（源码中直接使用，见 src/types/global.d.ts）。修改包名/版本无需改源码。
- 改动构建后验证方式：ESM/CJS 分别加载两个插件产物确认不抛错，然后跑 `examples/react-vite`（`npx vite build`）和 `examples/react-webpack`（`pnpm build`），在产物中确认中文被替换为 `xx("<16位hash>")` 调用。
- 已知 bug 清单见 BUGS.md。

## Architecture

三个相互独立的运行时，共享 utils 和类型：

1. **CLI 扫描/翻译**（`src/bin/i18n.ts` → `src/commands/Translate.ts`）：Node 侧运行。扫描入口文件 → babel AST 提取中文（JSXText / StringLiteral / TemplateLiteral）→ 以文本的 sha256 前 16 位为 id（`getHash`，src/utils/index.ts）→ 合并新旧语料 → 调翻译服务 → 写语言包 JSON。文件级缓存在 `node_modules/.cache/i18n-auto-plugin`（src/utils/ceche.ts，按 mtime+内容 hash 失效）。

2. **构建插件**（`src/plugins/`）：`core.ts` 的 `I18nPlugin` 是共享的 AST 转换核心 — 把中文字符串替换为 `_i18n(hash)` 调用并自动插入 import。`unplugin.ts` 用 createUnplugin 将其适配到各构建工具，`vite/plugin.ts`、`webpack/plugin.ts` 是入口封装。只替换语料库（lngMap）中已存在的文本，不存在时发 warning 提示更新语料库。

3. **运行时**（`src/index.ts`）：浏览器侧的 `I18nManager` — 维护语言映射、`i18n()` 翻译函数、`changeLanguage`（写 localStorage 并 reload）。插值语法为 `{{key}}`，模板字符串的表达式在扫描期被替换为 `{{@1}}`、`{{@2}}` 占位符（`tplRegexp`）。

### 关键共享逻辑

- **AST 解析**（src/utils/parse.ts）：`.vue` 文件先经 `vueSfcToTsx` 用 @vue/compiler-sfc 编译 template 成渲染代码再和 script 拼接解析，因此 CLI 扫描和插件转换对 Vue/React 走同一套 babel visitor。`isAllowTranslate` 是统一的过滤入口（中文检测 `ZH_EXT`、TS 字面量类型排除、excludeCall 调用名排除）。
- **扫描（Translate.ts）和转换（core.ts）的 visitor 必须保持一致**：两边对 JSXText/StringLiteral/TemplateLiteral 的文本规范化（trim、模板占位符替换）必须产生相同文本，否则 hash 对不上，转换时会找不到语料。
- **语言包两种格式**（src/types/index.d.ts）：`LanguagesMapById`（`{id: {lng: text}}`，splitLngFile=false 的单文件格式）和 `LanguagesMapByLocale`（`{lng: {id: text}}`，分文件格式）。`mergeLanguagesMap` / `extendLocale` 通过判断 key 是否在 `lngList` 中区分两种格式。
- **翻译器**（src/translators/）：抽象基类 `Translator` 处理分批（batchSize）、跳过已翻译、换行符转义（`✅✅` 占位）；子类只实现 `requestTranslate`。新增翻译服务需在 `translators/index.ts` 的 map 注册并在 types 中扩展 `TranslateServiceType`。
- **配置**：cosmiconfig 按 `i18n` 名称搜索（默认 `i18n.config.js`），`DEFAULT_CONFIG` 在 src/utils/config.ts。`Configuration` 类型是 normalize 后的（entry/include/exclude 转数组、加 `__rootPath`）。

## Conventions

- 代码注释和日志均为中文，保持一致。
- Prettier：单引号、无分号、trailing comma all（prettier.config.js）。
- 语言类型 `LngType` 目前硬编码五种语言（'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'zh-TW'），新增语言需同时改 src/types/index.d.ts 和 src/utils/config.ts 的 `lngList`、src/index.ts 的 `lngList`。
