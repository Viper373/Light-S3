# 🌈Light-S3·微光小溪

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
- 🌓 支持日间/夜间模式切换
- 🚀 优化的API请求缓存机制

## 技术栈 🛠️

- **前端框架**: Vue.js 3
- **构建工具**: Vue CLI
- **S3 客户端**: AWS SDK for JavaScript v3
- **后端**: FastAPI (Python)
- **数据库**: MongoDB
- **缓存**: FastAPI Cache
- **样式**: CSS (自定义样式)
- **图片懒加载**: Vue-Lazyload
- **文档系统**: VitePress
- **部署**: Vercel

## 项目结构 📂

```
Light-S3/
├── .env.production       # 生产环境变量配置
├── .eslintrc.js          # ESLint 配置
├── .gitignore            # Git 忽略文件配置
├── Procfile              # Heroku 部署配置
├── README.md             # 项目说明文档
├── package.json          # NPM 包配置
├── requirements.txt      # Python 依赖配置
├── vercel.json           # Vercel 部署配置
├── vue.config.js         # Vue CLI 配置
├── api/                  # Vercel Serverless Functions
│   └── index.py          # FastAPI 后端入口点
├── docs/                 # VitePress 文档系统
│   ├── docs/             # 文档内容
│   ├── .vitepress/       # VitePress 配置
│   └── package.json      # 文档系统 NPM 配置
├── public/               # 静态资源
│   └── index.html        # HTML 入口文件
└── src/                  # 源代码
├── App.vue           # 主应用组件
├── main.js           # 应用入口
├── components/       # 组件目录
│   ├── S3Browser.vue # S3浏览器组件
│   ├── script.js     # S3浏览器逻辑
│   └── style.css     # S3浏览器样式
└── utils/            # 工具函数
└── s3.js         # S3 工具函数
```


## 环境变量 🔐

项目使用以下环境变量进行配置：

| 变量名                      | 描述           | 示例值                               |
|--------------------------|--------------|-----------------------------------|
| VUE_APP_S3_ENDPOINT      | S3 服务端点      | https://s3.bitiful.net            |
| VUE_APP_S3_REGION        | S3 区域        | cn-east-1                         |
| VUE_APP_S3_ACCESS_KEY    | S3 访问密钥      | CYVLn8lssikCoSjACGCpqiO3gOg       |
| VUE_APP_S3_SECRET_KEY    | S3 秘密密钥      | gEKcmCVe12aVnb5jZ10MfBh3GcYXKHMWQ |
| VUE_APP_S3_BUCKET        | S3 存储桶名称     | viper3                            |
| VUE_APP_S3_DOMAIN        | S3 初始访问域名    | viper3.s3.bitiful.net             |
| VUE_APP_S3_CUSTOM_DOMAIN | S3自定义域名      | bitiful.viper3.top                |
| IMG_CDN                  | 图床CDN        | https://cdn.jsdelivr.net/gh       |
| GH_OWNER                 | Github用户名    | Viper373                          |
| GH_REPO                  | 图床Github仓库名称 | picx-images-hosting               |
| MONGODB_URI              | MongoDB连接URI | mongodb://localhost:27017/        |
| DB_NAME                  | 数据库名称        | XOVideos                          |
| COL_NAME                 | 集合名称         | pornhub                           |

## Vercel部署 🚀
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Viper373/S3Browser)

点击上方的"Deploy with Vercel"按钮，可以一键将项目部署到Vercel平台。
部署后，您可以通过以下路径访问不同的服务：

- **前端应用**: `https://your-vercel-domain.vercel.app/`
- **API文档**: `https://your-vercel-domain.vercel.app/api/docs`
- **VitePress文档**: `https://your-vercel-domain.vercel.app/docs/`
在Vercel部署时，需要配置以下环境变量：

1. 在Vercel项目设置中，找到"Environment Variables"部分
2. 添加所有必要的环境变量（参考上面的环境变量表）
3. 确保敏感信息（如S3密钥和MongoDB URI）已正确设置

## 私有部署 🚀

### 前端

```bash
# 安装依赖
npm install

# 开发模式运行（端口 8888）
npm run serve

# 构建生产版本
npm run build
```

### 后端

```bash
# 安装依赖
pip install -r requirements.txt

# 运行后端服务（端口 8000）
uvicorn app:app
```

### 本地开发环境部署

#### 前端部署

```bash
# 克隆仓库
git clone https://github.com/Viper373/S3Browser.git
cd S3Browser

# 创建并配置环境变量
在本地创建 `.env.local` 文件，并添加必要的环境变量（参考上面的环境变量表）
# 安装依赖并启动前端服务
npm install
npm run serve
```

#### 后端部署

```bash
# 安装依赖
pip install -r requirements.txt

# 运行后端服务（端口 8000）
uvicorn app:app --reload --port 8000

```

#### VitePress文档部署
```bash
# 进入VitePress目录
cd docs
# 安装依赖
npm install
# 启动开发服务器
npm run dev
```

#### 后端部署

```bash
# 克隆仓库
git clone https://github.com/Viper373/S3Browser.git
cd S3Browser
# 创建并配置环境变量
在本地创建 `.env.local` 文件，并添加必要的环境变量（参考上面的环境变量表）
# 安装依赖并启动后端服务
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```


## 后端 API 📡

- **GET /api/xovideos**: 获取视频元数据
  - 参数: `author` (可选) - 按作者筛选视频
  - 返回: 包含视频标题、观看次数和时长的 JSON 数据
  ```json
  {
  "status": "success",
  "data": [
      {
        "author": "作者名称",
        "video_title": "视频标题",
        "video_views": "观看次数",
        "duration": "视频时长"
      }
    ]
  }
  ```
- **GET /api/health**: 检查后端服务健康状态
  - 返回: 包含状态信息的 JSON 数据
  ```json
  {
    "status": "healthy"
  }
  ```

## 安全注意事项 🔒

- 不要在版本控制中提交 `.env.local` 文件
- 在生产环境中使用环境变量或密钥管理服务存储敏感信息
- 考虑使用 AWS IAM 角色而不是硬编码的访问密钥
- 限制 CORS 配置，只允许必要的源

## TODO ✈

- 添加用户认证系统
- 实现文件上传功能
- 添加视频转码功能
- 优化移动端体验
- 添加更多自定义主题


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