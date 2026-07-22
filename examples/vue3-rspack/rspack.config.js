const path = require('path')
const { VueLoaderPlugin } = require('vue-loader')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { I18nAutoRspackPlugin } = require('i18n-auto-plugin/rspack')

// rspack 兼容 webpack loader 生态,配置与 webpack 类似
// rspack 内置多线程 transpiler(不用 thread-loader),无 webpack 那个 parallel 冲突
module.exports = {
  entry: { main: './src/main.js' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      { test: /\.vue$/, loader: 'vue-loader' },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      { test: /\.css$/, use: ['vue-style-loader', 'css-loader'] },
      { test: /\.(png|jpe?g|gif|svg)$/, type: 'asset/resource' },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new I18nAutoRspackPlugin(),
    new HtmlWebpackPlugin({ template: './index.html' }),
  ],
  resolve: { extensions: ['.js', '.vue'] },
}
