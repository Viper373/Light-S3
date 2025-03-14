/* .vitepress/config.mts */
import { defineConfig } from 'vitepress'

export default defineConfig({
  head: [
    ['link', { rel: 'icon', href: 'bitiful.png' }], // 添加站点图标
  ],
  themeConfig: {
    //左上角logo
    logo: '/bitiful.png',
    // 设置站点标题
    siteTitle: '缤纷云（Bitiful）S4',
    //导航栏
    nav: [
      { text: '主页', link: '/' },
      { text: 'API接口示例', link: 'http://s4.viper3.top/api/docs' },
    ],
    //本地搜索 //
    search: {
      provider: 'local'
    },
    //社交链接 //
    socialLinks: [
      { icon: 'bloglovin', link: 'https://blog.viper3.top' },
      { icon: 'github', link: 'https://github.com/Viper373' },
      { icon: 'qq', link: 'https://tool.gljlw.com/qqq/?qq=2483523414' },
      { icon: 'wechat', link: 'https://viper3-1318672778.cos.ap-beijing.myqcloud.com/user/wechat.png' },
    ],
  },
  //markdown配置
  markdown: {
    // 组件插入h1标题下
    config: (md) => {
      md.renderer.rules.heading_close = (tokens, idx, options, env, slf) => {
        let htmlResult = slf.renderToken(tokens, idx, options);
        if (tokens[idx].tag === 'h1') htmlResult += `<ArticleMetadata />`;
        return htmlResult;
      }
    }
  }

})