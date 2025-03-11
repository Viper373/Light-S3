import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export default {
  data() {
    return {
      currentPath: '',
      files: [],
      loading: false,
      error: null,
      browsingHistory: [],
      historyIndex: -1,  // 初始值改为-1
      scrollObserver: null,  // 添加逗号
      directoryCache: {},  // 缓存对象
      videoPlayerVisible: false,
      currentVideo: null
    };
  },

  computed: {
    pathParts() {
      return this.currentPath.split('/').filter(p => p);
    },
  },

  watch: {
    currentPath() {
      // 检查缓存中是否已有当前路径的数据
      if (this.directoryCache[this.currentPath]) {
        this.files = this.directoryCache[this.currentPath];
      } else {
        this.loadFileList();
      }
      this.updateBrowserUrl();
    }
  },

  async created() {
    // 初始化S3客户端
    this.s3Client = new S3Client({
      region: process.env.VUE_APP_S3_REGION,
      endpoint: process.env.VUE_APP_S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.VUE_APP_S3_ACCESS_KEY,
        secretAccessKey: process.env.VUE_APP_S3_SECRET_KEY
      },
      forcePathStyle: true // 重要：兼容S3兼容服务
    });

    window.addEventListener('mouseup', this.handleMouseButtons);
    this.initPathFromUrl();
    await this.loadInitialData();
  },

  beforeUnmount() {
    window.removeEventListener('mouseup', this.handleMouseButtons);
    this.scrollObserver?.disconnect();
  },
  methods: {
    generatePlaceholder(key) {
      // 生成动态颜色占位符
      const colors = ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6'];
      const hash = Array.from(key).reduce((acc, char) => 
        char.charCodeAt(0) + (acc << 5) - acc, 0);
      const color = colors[Math.abs(hash) % colors.length];
      
      return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' 
        width='1600' height='900' viewBox='0 0 16 9' preserveAspectRatio='none'>
        <rect width='16' height='9' fill='${encodeURIComponent(color)}'/>
        <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
          font-family='system-ui, sans-serif' font-size='1.5' fill='%23fff'>
          ${encodeURIComponent(key.split('/').pop()?.substring(0, 12) || '')}
        </text>
      </svg>`;
    },
    responsiveSrcSet(file) {
      if (!file.thumbnailUrl) return '';
      const sizes = [320, 640, 1024, 1600];
      return sizes.map(size => 
        `${file.thumbnailUrl}?w=${size}&q=${size <= 640 ? 85 : 75} ${size}w`
      ).join(', ');
    },
    fallbackHandler(el) {
      el.style.background = `linear-gradient(45deg, #${Math.floor(Math.random()*16777215).toString(16)}, 
        #${Math.floor(Math.random()*16777215).toString(16)})`;
      el.style.backgroundSize = 'cover';
    },
    // 初始化方法
    initPathFromUrl() {
      const urlParams = new URLSearchParams(window.location.search);
      const initialPath = urlParams.get('path') || '';
      this.browsingHistory = [initialPath];
      this.historyIndex = 0;  // 初始化索引设为0
      this.currentPath = initialPath;
    },
    // 增强的历史记录管理
    updateHistory(newPath) {
      // 当通过后退/前进操作时不清除后续历史
      if (newPath === this.browsingHistory[this.historyIndex]) return;

      this.browsingHistory = [...this.browsingHistory.slice(0, this.historyIndex + 1), newPath];
      this.historyIndex = this.browsingHistory.length - 1;
    },
    // 修复前进/后退方法
    navigateBack() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.currentPath = this.browsingHistory[this.historyIndex];
      }
    },
    navigateForward() {
      if (this.historyIndex < this.browsingHistory.length - 1) {
        this.historyIndex++;
        this.currentPath = this.browsingHistory[this.historyIndex];
      }
    },
    async loadFileList() {
      // 如果缓存中已有数据，直接使用缓存
      if (this.directoryCache[this.currentPath]) {
        this.files = this.directoryCache[this.currentPath];
        return;
      }

      this.loading = true;
      try {
        // 发送S3列表请求
        const command = new ListObjectsV2Command({
          Bucket: process.env.VUE_APP_S3_BUCKET,
          Prefix: this.currentPath,
          Delimiter: '/'
        });

        // 获取元数据的URL应该使用环境变量或配置
        const apiUrl = process.env.VUE_APP_API_URL || 'http://127.0.0.1:8000';

        // 同时获取S3数据和视频元数据
        const [s3Response, metaResponse] = await Promise.all([
          this.s3Client.send(command),
          fetch(`${apiUrl}/xovideos`).then(res => res.json())
        ]);

        // 处理目录
        const dirs = (s3Response.CommonPrefixes || []).map(prefix => ({
          Key: prefix.Prefix,
          IsDirectory: true,
          Size: 0,
          LastModified: new Date().toISOString()
        }));
        // 处理文件并整合元数据
        const files = (s3Response.Contents || [])
          .filter(file => !file.Key.endsWith('/')) // 过滤掉目录
          .map(file => {
            // 从文件路径中提取作者和标题
            const pathParts = file.Key.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, '');
            const author = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '';

            // 查找匹配的元数据 - 改进匹配逻辑
            const videoMeta = metaResponse.data.find(v =>
              v.author === author &&
              (v.video_title === fileNameWithoutExt ||
                v.video_title.toLowerCase() === fileNameWithoutExt.toLowerCase())
            ) || {};
            
            // 构建 GitHub 图床的缩略图 URL
            const githubThumbnailUrl = `https://cdn.jsdelivr.net/gh/Viper373/picx-images-hosting/${encodeURIComponent(author)}/${encodeURIComponent(fileNameWithoutExt)}.jpg`;
            
            // 直接使用后端返回的数据，不做处理
            return {
              Key: file.Key,
              IsDirectory: false,
              Size: file.Size,
              LastModified: file.LastModified?.toISOString(),
              // 优先使用 GitHub 图床的缩略图
              thumbnailUrl: githubThumbnailUrl,
              // 保留原始视频 URL 用于播放
              videoUrl: `${process.env.VUE_APP_S3_ENDPOINT.replace('viper3.s3.bitiful.net', 'bitiful.viper3.top')}/${process.env.VUE_APP_S3_BUCKET}/${encodeURIComponent(file.Key)}`,
              views: videoMeta.video_views || null,
              duration: videoMeta.duration || null
            };
          });

        const fileList = [...dirs, ...files];
        // 将结果存入缓存
        this.directoryCache[this.currentPath] = fileList;
        this.files = fileList;
      } catch (error) {
        console.error('加载失败:', error);
        this.error = '加载失败: ' + error.message;
      } finally {
        this.loading = false;
      }
    }, // methods 结束
    async loadInitialData() {
      await this.loadFileList();
    },
    updateBrowserUrl() {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('path', this.currentPath);
      window.history.replaceState({}, '', newUrl.toString());
    },
    handleFileClick(file) {
      if (file.IsDirectory) {
        const newPath = file.Key.replace(/\/?$/, '/');
        this.updateHistory(newPath);
        this.currentPath = newPath;
      } else {
        // 处理视频文件点击
        // 使用预先构建的视频URL
        const videoUrl = file.videoUrl;
        
        // 设置当前视频并显示播放器
        this.currentVideo = {
          url: videoUrl,
          title: this.cleanFileName(file.Key),
          key: file.Key
        };
        this.videoPlayerVisible = true;
      }
    },
    // 添加关闭视频播放器的方法
    closeVideoPlayer() {
      this.videoPlayerVisible = false;
      this.currentVideo = null;
    },
    processS3Response(response) {
      const dirs = (response.CommonPrefixes || []).map(prefix => ({
        Key: prefix.Prefix,
        IsDirectory: true,
        Size: 0,
        LastModified: new Date().toISOString()
      }));

      const files = (response.Contents || []).map(file => ({
        Key: file.Key,
        IsDirectory: false,
        Size: file.Size,
        LastModified: file.LastModified?.toISOString()
      }));

      return [...dirs, ...files];
    },
    // 目录名称处理方法
    getFolderName(key) {
      return key.replace(/\/+$/, '').split('/').pop();
    },
    // 文件名处理方法
    cleanFileName(key) {
      return key.split('/').pop().replace(/\.[^.]+$/, '');
    },
    // 文件大小格式化方法
    formatSize(bytes) {
      if (typeof bytes !== 'number') return '0 B';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
      return `${(bytes / 1073741824).toFixed(1)} GB`;
    },
    // 日期格式化方法
    formatDate(timestamp) {
      try {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(/\//g, '-');
      } catch (e) {
        console.warn('日期格式错误:', timestamp);
        return 'N/A';
      }
    },
    // 视频时长格式化方法
    formatDuration(duration) {
      // 如果没有时长数据，返回N/A
      if (!duration) return 'N/A';
      
      // 直接返回后端提供的时长字符串
      return duration;
    },

    // 播放量格式化方法
    formatViews(views) {
      // 如果没有观看次数数据，返回N/A
      if (!views) return 'N/A';
      
      // 直接返回后端提供的观看次数字符串
      return views;
    },
    // 处理鼠标按钮事件
    handleMouseButtons(event) {
      // 处理鼠标侧键导航
      if (event.button === 3) { // 后退键
        this.navigateBack();
      } else if (event.button === 4) { // 前进键
        this.navigateForward();
      }
    },
    // 添加根目录导航方法
    navigateToRoot() {
      this.updateHistory('');
      this.currentPath = '';
    },
    // 添加面包屑导航方法
    navigateTo(index) {
      const newPath = this.pathParts.slice(0, index + 1).join('/') + '/';
      this.updateHistory(newPath);
      this.currentPath = newPath;
    },

    // 添加清除缓存的方法
    clearCache(path = null) {
      if (path) {
        delete this.directoryCache[path];
      } else {
        this.directoryCache = {};
      }
    },

    // 添加刷新当前目录的方法
    refreshCurrentDirectory() {
      this.clearCache(this.currentPath);
      this.loadFileList();
    },
  }
}