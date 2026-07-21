const { defineConfig } = require("@vue/cli-service");
const { I18nAutoWebpackPlugin } = require("i18n-auto-plugin/webpack");
module.exports = defineConfig({
  transpileDependencies: true,
  // unplugin 注入的 loader 与 thread-loader 跨线程序列化冲突(Compiler 循环引用),
  // 需关闭多线程转译
  parallel: false,
  configureWebpack: { plugins: [new I18nAutoWebpackPlugin()] },
  chainWebpack: (config) => {
    // 示例项目 eslint 配置不全,关闭 build 时的 lint
    config.plugins.delete("eslint");
  },
});
