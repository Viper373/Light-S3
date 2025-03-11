/* .vitepress/theme/index.ts */
import { watch } from 'vue'
import DefaultTheme from 'vitepress/theme'
import Mycomponent from "./components/Mycomponent.vue"
import confetti from "./components/confetti.vue"
import DataPanel from "./components/DataPanel.vue"
import update from "./components/update.vue"
import ArticleMetadata from "./components/ArticleMetadata.vue"
import backtotop from "./components/backtotop.vue"
import { h } from 'vue'
// 不蒜子
import { inBrowser } from 'vitepress'
import busuanzi from 'busuanzi.pure.js'
import HomeUnderline from "./components/HomeUnderline.vue"
import './style/index.css'

/* .vitepress/theme/index.ts */
// 彩虹背景动画样式
let homePageStyle: HTMLStyleElement | undefined

export default {
    extends: DefaultTheme,
    Layout() {
        return h(DefaultTheme.Layout, null, {
            'doc-footer-before': () => h(backtotop), // 使用doc-footer-before插槽
        })
    },
    enhanceApp({ app, router }) {
        if (inBrowser) {
            router.onAfterRouteChanged = () => {
                busuanzi.fetch()
            }
        }
        // 注册全局组件
        app.component('HomeUnderline', HomeUnderline)
        // 注册全局组件
        app.component('ArticleMetadata', ArticleMetadata)
        // 注册全局组件
        app.component('update', update)
        // 注册全局组件
        app.component('DataPanel', DataPanel)
        // 注册全局组件
        app.component('Mycomponent', Mycomponent)
        // 注册全局组件
        app.component('confetti', confetti)
        // 彩虹背景动画样式
        if (typeof window !== 'undefined') {
            watch(
                () => router.route.data.relativePath,
                () => updateHomePageStyle(location.pathname === '/'),
                { immediate: true },
            )
        }

    },
}

// 彩虹背景动画样式
function updateHomePageStyle(value: boolean) {
    if (value) {
        if (homePageStyle) return

        homePageStyle = document.createElement('style')
        homePageStyle.innerHTML = `
    :root {
      animation: rainbow 12s linear infinite;
    }`
        document.body.appendChild(homePageStyle)
    } else {
        if (!homePageStyle) return

        homePageStyle.remove()
        homePageStyle = undefined
    }
}