# S3Browser 项目文档 📁

## 项目概述 🌟

S3Browser 是一个基于 Vue.js 的 S3 兼容存储服务浏览器，允许用户浏览、查看和管理存储在 S3 兼容存储服务中的文件，特别是视频文件。该应用提供了直观的用户界面，支持视频预览、缩略图显示和元数据展示。

## 功能特点 ✨

- 🗂️ 文件和目录浏览
- 🎬 视频文件在线播放
- 🖼️ 视频缩略图预览
- 📊 显示文件元数据（大小、修改日期、观看次数、时长）
- 🔄 浏览历史记录（前进/后退导航）
- 🍞 面包屑导航
- 🔍 与 MongoDB 集成获取视频元数据

## 技术栈 🛠️

- **前端框架**: Vue.js 3
- **构建工具**: Vue CLI
- **S3 客户端**: AWS SDK for JavaScript
- **后端**: FastAPI (Python)
- **数据库**: MongoDB
- **样式**: CSS (自定义样式)
- **图片懒加载**: Vue-Lazyload

## 项目结构 📂

```
S3Browser/
├── .env.production       # 生产环境变量配置
├── .env.local            # 本地环境变量配置（不提交到版本控制）
├── .eslintrc.js          # ESLint 配置
├── app.py                # FastAPI 后端服务
├── package.json          # NPM 包配置
├── vue.config.js         # Vue CLI 配置
├── public/               # 静态资源
├── src/                  # 源代码
│   ├── App.vue           # 主应用组件
│   ├── components/       # 组件目录
│   │   ├── S3Browser.vue # S3浏览器组件
│   │   ├── script.js     # S3浏览器逻辑
│   │   └── style.css     # S3浏览器样式
│   ├── main.js           # 应用入口
│   └── utils/            # 工具函数
└── S3Videos/             # 视频相关文档
```

## 环境变量 🔐

项目使用以下环境变量进行配置：

| 变量名                   | 描述       | 示例值                               |
|-----------------------|----------|-----------------------------------|
| VUE_APP_S3_ENDPOINT   | S3 服务端点  | https://s3.bitiful.net            |
| VUE_APP_S3_REGION     | S3 区域    | cn-east-1                         |
| VUE_APP_S3_ACCESS_KEY | S3 访问密钥  | CYVLn8lssikCoSjACGCpqiO3gOg       |
| VUE_APP_S3_SECRET_KEY | S3 秘密密钥  | gEKcmCVe12aVnb5jZ10MfBh3GcYXKHMWQ |
| VUE_APP_S3_BUCKET     | S3 存储桶名称 | viper3                            |

## 安装与运行 🚀

### 前端

```bash
# 安装依赖
npm install

# 开发模式运行（端口 8888）
npm run serve

# 构建生产版本
npm run build

# 代码检查
npm run lint
```

### 后端

```bash
# 安装依赖
pip install -r requirements.txt

# 运行后端服务
uvicorn app:app
```

## 后端 API 📡

后端提供以下 API 端点：

- **GET /xovideos**: 获取视频元数据
  - 参数: `author` (可选) - 按作者筛选视频
  - 返回: 包含视频标题、观看次数和时长的 JSON 数据

## 部署 🌐

### 前端部署

1. 创建生产环境变量文件 `.env.production`
2. 运行 `npm run build` 生成生产版本
3. 将 `dist` 目录部署到 Web 服务器

### 后端部署

1. 确保 MongoDB 连接配置正确
2. 使用 Gunicorn 或其他 WSGI 服务器部署 FastAPI 应用
3. 配置 CORS 以允许前端访问

## 安全注意事项 🔒

- 不要在版本控制中提交 `.env.local` 文件
- 在生产环境中使用环境变量或密钥管理服务存储敏感信息
- 考虑使用 AWS IAM 角色而不是硬编码的访问密钥
- 限制 CORS 配置，只允许必要的源

## 贡献指南 👥

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证 📄

本项目采用 [MIT 许可证](LINCENSE) 。

## 联系方式 📧

2483523414@qq.com

---

⭐ 如果您觉得这个项目有用，请给它一个star星标！