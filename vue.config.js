module.exports = {
  chainWebpack: config => {
    config.plugin('define').tap(args => {
      // 添加所有 Vue 3 功能标志
      args[0].__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = 'false'
      args[0].__VUE_PROD_DEVTOOLS__ = 'false'
      args[0].__VUE_OPTIONS_API__ = 'true'
      args[0].__VUE_PROD_HYDRATION_MISMATCH__ = 'false'
      return args
    })
  },
  transpileDependencies: true,
  configureWebpack: {
    resolve: {
      fallback: {
        "stream": require.resolve("stream-browserify"),
        "crypto": require.resolve("crypto-browserify")
      }
    }
  },
  devServer: {
    proxy: {
      '/s3-proxy': {
        target: 'https://s3.bitiful.net',
        changeOrigin: true,
        pathRewrite: {
          '^/s3-proxy': ''
        }
      }
    }
  }
}