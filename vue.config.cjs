const ESLintPlugin = require('eslint-webpack-plugin');
const path = require('path');

module.exports = {
  lintOnSave: false,
  publicPath: '/',
  chainWebpack: config => {
    config.plugin('define').tap(args => {
      args[0].__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = 'false';
      args[0].__VUE_PROD_DEVTOOLS__ = 'false';
      args[0].__VUE_OPTIONS_API__ = 'true';
      args[0].__VUE_PROD_HYDRATION_MISMATCH__ = 'false';
      return args;
    });
  },
  transpileDependencies: true,
  configureWebpack: {
    plugins: [
      new ESLintPlugin({
        files: ['**/*.{js,vue}'],
        failOnError: false,
        lintDirtyModulesOnly: true,
        useEslintrc: false,
        overrideConfigFile: path.resolve(__dirname, 'eslint.config.js'),
      }),
    ],
    resolve: {
      fallback: {
        "stream": path.resolve('node_modules/stream-browserify'),
        "crypto": path.resolve('node_modules/crypto-browserify'),
        "path": path.resolve('node_modules/path-browserify'),
      },
    },
  },
  devServer: {
    proxy: {
      '/s3-proxy': {
        target: 'https://s3.bitiful.net',
        changeOrigin: true,
        pathRewrite: { '^/s3-proxy': '' },
      },
      '/api': {
        target: 'http://localhost:8000', // 根据你的后端地址调整
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
      },
    },
  },
};