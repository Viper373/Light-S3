# 🌈 Light-S4·微光小溪

<div align="center">
  <img src="public/icon-192x192.png" alt="微光小溪 Logo" width="120"/>
  <p>优雅而强大的 S3 兼容存储服务浏览器</p>
  <p>
    <a href="https://github.com/Viper373/Light-S4/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/Viper373/Light-S4" alt="license"/>
    </a>
    <a href="https://github.com/Viper373/Light-S4/releases">
      <img src="https://img.shields.io/github/v/release/Viper373/Light-S4" alt="release"/>
    </a>
    <a href="https://github.com/Viper373/Light-S4/issues">
      <img src="https://img.shields.io/github/issues/Viper373/Light-S4" alt="issues"/>
    </a>
  </p>
</div>

## 🌟 项目概述

Light-S4·微光小溪是一个基于 Next.js 的现代化 S3 兼容存储服务浏览器，为用户提供了优雅而强大的文件管理体验。它不仅支持基本的文件操作，还提供了专业的视频管理和播放功能，让文件管理变得轻松愉悦。

## ✨ 核心特性

### 🎯 通用功能
- 💫 优雅的用户界面，支持亮暗主题切换
- 🚀 快速的文件浏览和预览
- 📱 完美的移动端适配
- 🔍 强大的搜索功能（支持模糊搜索、后缀搜索）
- 🌐 PWA 支持，可安装为本地应用

### 📁 文件管理
- 📂 直观的文件目录浏览
- 📊 详细的文件信息显示
- 🔄 文件操作历史记录
- 🍞 智能的面包屑导航
- 📈 文件使用统计

### 🎬 视频功能
- ▶️ 流畅的视频在线播放
- 🖼️ 智能视频缩略图
- 📊 视频元数据展示
- 🎯 视频播放历史记录
- 📺 自适应播放器

## 🛠️ 技术栈

- **核心框架**: [Next.js 14](https://nextjs.org/)
- **UI 框架**: [Tailwind CSS](https://tailwindcss.com/)
- **状态管理**: [React Context](https://react.dev/reference/react/useContext)
- **数据库**: [MongoDB](https://www.mongodb.com/)
- **存储服务**: [AWS S3 Compatible Storage](https://aws.amazon.com/s3/)
- **部署平台**: [Vercel](https://vercel.com/)

## 📂 项目结构

```
Light-S4/
├── app/                      # Next.js 应用目录
│   ├── layout.tsx           # 全局布局
│   ├── page.tsx            # 首页
│   ├── globals.css         # 全局样式
│   ├── s3-manager/        # S3 管理器
│   │   ├── components/    # 管理器组件
│   │   │   ├── FileManager.tsx    # 文件管理器组件
│   │   │   └── FileList.tsx       # 文件列表组件
│   │   └── page.tsx       # 管理器页面
│   └── video-station/     # 视频站
│       ├── components/    # 视频站组件
│       │   ├── VideoPlayer.tsx    # 视频播放器
│       │   └── VideoList.tsx      # 视频列表
│       └── page.tsx       # 视频站页面
├── components/             # 共享组件
│   ├── ui/               # UI 组件
│   │   ├── button.tsx   # 按钮组件
│   │   └── sidebar.tsx  # 侧边栏组件
│   └── shared/          # 通用组件
├── hooks/                 # 自定义 Hooks
│   ├── use-s3.ts        # S3 操作 Hook
│   └── use-theme.ts     # 主题切换 Hook
├── lib/                   # 工具函数
│   ├── s3-client.ts     # S3 客户端
│   └── utils.ts         # 通用工具函数
├── public/               # 静态资源
│   ├── icons/           # 应用图标
│   ├── manifest.json    # PWA 配置
│   └── service-worker.js # Service Worker
├── styles/               # 样式文件
│   └── globals.css      # 全局样式
├── config/              # 配置文件
│   └── site.ts         # 站点配置
├── .env.local          # 环境变量
├── .eslintrc.json      # ESLint 配置
├── next.config.mjs     # Next.js 配置
├── package.json        # 项目依赖
├── postcss.config.js   # PostCSS 配置
├── tailwind.config.ts  # Tailwind 配置
├── tsconfig.json       # TypeScript 配置
└── vercel.json         # Vercel 部署配置
```

## 🚀 快速开始

### 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FViper373%2FLightS4&env=NEXT_PUBLIC_S3_ENDPOINT,NEXT_PUBLIC_S3_REGION,NEXT_PUBLIC_S3_ACCESS_KEY,NEXT_PUBLIC_S3_SECRET_KEY,NEXT_PUBLIC_S3_BUCKET,NEXT_PUBLIC_IMG_CDN,NEXT_PUBLIC_GH_OWNER,NEXT_PUBLIC_GH_REPO,NEXT_PUBLIC_MONGODB_URI,NEXT_PUBLIC_DB_NAME,NEXT_PUBLIC_COL_NAME&project-name=light-s4&repository-name=LightS4)

### 环境要求
- **Node.js** 20.0 或更高版本
- **MongoDB** 4.4 或更高版本
- **S3** 兼容的存储服务

### 本地开发

1. 克隆仓库
```bash
git clone https://github.com/Viper373/LightS4.git
cd LightS4
```

2. 安装依赖
```bash
npm install
```
3. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 文件，填入必要的配置信息
```

4. 启动开发服务器
```bash
npm run dev
```

### 生产部署

1. 构建应用
```bash
npm run build
```

2. 启动生产服务器
```bash
npm run start
```

## ⚙️ 环境变量

项目使用以下环境变量进行配置（创建 `.env.local` 文件）：

### S3 存储配置
| 变量名 | 必填 | 描述 | 示例值 |
|-------|------|------|--------|
| NEXT_PUBLIC_S3_ENDPOINT | ✅ | S3 服务端点 | https://s3.
bitiful.net |
| NEXT_PUBLIC_S3_REGION | ✅ | S3 区域 | cn-east-1 |
| NEXT_PUBLIC_S3_ACCESS_KEY | ✅ | S3 访问密钥 | YOUR_ACCESS_KEY |
| NEXT_PUBLIC_S3_SECRET_KEY | ✅ | S3 密钥 | YOUR-SECRET_KEY |
| NEXT_PUBLIC_S3_BUCKET | ✅ | S3 存储桶名称 | YOUR_BUCKET |

### 缩略图配置
| 变量名 | 必填 | 描述 | 示例值 |
|-------|------|------|--------|
| NEXT_PUBLIC_IMG_CDN | ✅ | 图片 CDN 地址 | https://cdn.example.com |
| NEXT_PUBLIC_GH_OWNER | ✅ | GitHub 用户名 | your-username |
| NEXT_PUBLIC_GH_REPO | ✅ | GitHub 仓库名 | your-image-repo |

### MongoDB 配置
| 变量名 | 必填 | 描述 | 示例值 |
|-------|------|------|--------|
| NEXT_PUBLIC_MONGODB_URI | ✅ | MongoDB 连接 URI | mongodb+srv://username:password@cluster.mongodb.net |
| NEXT_PUBLIC_DB_NAME | ✅ | 数据库名称 | your_database |
| NEXT_PUBLIC_COL_NAME | ✅ | 集合名称 | your_collection |

### 应用配置
| 变量名 | 必填 | 描述 | 示例值 |
|-------|------|------|--------|
| NEXT_PUBLIC_APP_URL | ❌ | 应用 URL | https://your-app-name.vercel.app |
| NODE_ENV | ❌ | 运行环境 | development/production |

## 🔧 配置说明

### S3 存储配置
- 支持所有兼容 S3 协议的存储服务
- 支持自定义域名
- 支持自定义 CDN

### MongoDB 配置
- 支持 MongoDB Atlas
- 支持自托管 MongoDB
- 支持数据库副本集

## 📚 API 文档

### 视频 API

#### `GET /api/xovideos`

获取视频列表，支持按作者筛选。

**请求参数：**

```typescript
{
  author?: string;        // 可选，作者名称，不传则返回所有作者的视频
}
```

**返回示例：**

```json
{
  "status": "success",
  "data": [
    {
      "author": "作者名称",
      "video_title": "视频标题",
      "video_views": "1000",
      "duration": "10:30"
    }
  ]
}
```

**错误响应：**

```json
{
  "status": "error",
  "message": "错误信息"
}
```

**说明：**
- 接口使用缓存，缓存时间为 7200 秒（2小时）
- 当数据库连接失败时，会返回测试数据
- 视频数据来源于 MongoDB，包含作者名称、视频标题、观看次数和视频时长
- 空的作者名称会被替换为"未知作者"

#### `GET /api`

检查 API 服务状态。

**返回示例：**

```json
{
  "message": "API 服务正常运行"
}
```

## 🎯 开发路线图

### 即将推出
- [ ] 文件批量操作
- [ ] 更多自定义主题

### 规划中
- [ ] 文件分享功能
- [ ] 协作编辑

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 📮 联系方式

- 邮箱：2483523414@qq.com
- Issues：[GitHub Issues](https://github.com/Viper373/Light-S4/issues)

## 🌟 致谢

感谢所有为本项目做出贡献的开发者！

---

如果这个项目对您有帮助，请给它一个 star ⭐️
