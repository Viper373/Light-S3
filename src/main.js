import { createApp } from 'vue'
import App from './App.vue'
import VueLazyload from 'vue-lazyload'

// 定义 Vue 功能标志
window.__VUE_OPTIONS_API__ = true
window.__VUE_PROD_DEVTOOLS__ = false
window.__VUE_PROD_HYDRATION_MISMATCH__ = false
window.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false

const app = createApp(App)

// 配置懒加载
app.use(VueLazyload, {
  preLoad: 1.3,
  error: 'https://placehold.co/400x225?text=加载失败',
  loading: 'https://placehold.co/400x225?text=加载中...',
  attempt: 1
})

app.mount('#app')