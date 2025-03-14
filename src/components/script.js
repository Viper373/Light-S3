import {S3Client, ListObjectsV2Command} from "@aws-sdk/client-s3";

// 添加API请求缓存
const apiCache = {};

// 添加fetchWithRetry工具函数
async function fetchWithRetry(url, options = {}, retries = 2, delay = 500) {
    // 检查缓存
    if (apiCache[url]) {
        return apiCache[url];
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // 缓存结果
        apiCache[url] = data;
        return data;
    } catch (error) {
        if (retries <= 0) {
            throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
}

export default {
    data() {
        return {
            currentPath: '',
            files: [],
            loading: false,
            error: null,
            browsingHistory: [],
            historyIndex: -1,
            scrollObserver: null,
            directoryCache: {},
            videoPlayerVisible: false,
            currentVideo: null,
        };
    },

    computed: {
        pathParts() {
            return this.currentPath.split('/').filter((p) => p);
        },
    },

    watch: {
        currentPath() {
            if (this.directoryCache[this.currentPath]) {
                this.files = this.directoryCache[this.currentPath];
            } else {
                this.loadFileList();
            }
            this.updateBrowserUrl();
        },
    },

    async created() {
        this.initializeS3Client();
        window.addEventListener('mouseup', this.handleMouseButtons);
        this.initPathFromUrl();
        await this.loadInitialData();
    },

    mounted() {
        this.applyDarkModePreference();
    },

    beforeUnmount() {
        window.removeEventListener('mouseup', this.handleMouseButtons);
        this.scrollObserver?.disconnect();
    },

    methods: {
        /** 初始化 S3 客户端 */
        initializeS3Client() {
            this.s3Client = new S3Client({
                region: process.env.VUE_APP_S3_REGION,
                endpoint: process.env.VUE_APP_S3_ENDPOINT,
                credentials: {
                    accessKeyId: process.env.VUE_APP_S3_ACCESS_KEY,
                    secretAccessKey: process.env.VUE_APP_S3_SECRET_KEY,
                },
                forcePathStyle: true,
            });
        },

        /** 应用深色模式偏好 */
        applyDarkModePreference() {
            const savedDarkMode = localStorage.getItem('darkMode');
            if (savedDarkMode === 'true') {
                document.body.classList.add('dark-mode');
            } else if (
                savedDarkMode === null &&
                window.matchMedia('(prefers-color-scheme: dark)').matches
            ) {
                document.body.classList.add('dark-mode');
            }
        },

        /** 切换深色模式 */
        toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDarkMode = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDarkMode);
        },

        /** 生成占位符图像 */
        generatePlaceholder(key) {
            const colors = ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6'];
            const hash = Array.from(key).reduce(
                (acc, char) => char.charCodeAt(0) + (acc << 5) - acc,
                0
            );
            const color = colors[Math.abs(hash) % colors.length];
            return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 16 9' preserveAspectRatio='none'><rect width='16' height='9' fill='${encodeURIComponent(color)}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui, sans-serif' font-size='1.5' fill='%23fff'>${encodeURIComponent(key.split('/').pop()?.substring(0, 12) || '')}</text></svg>`;
        },

        /** 从 URL 初始化路径 */
        initPathFromUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            const initialPath = urlParams.get('path') || '';
            this.browsingHistory = [initialPath];
            this.historyIndex = 0;
            this.currentPath = initialPath;
        },

        /** 更新浏览历史 */
        updateHistory(newPath) {
            if (newPath === this.browsingHistory[this.historyIndex]) return;
            this.browsingHistory = [
                ...this.browsingHistory.slice(0, this.historyIndex + 1),
                newPath,
            ];
            this.historyIndex = this.browsingHistory.length - 1;
        },

        /** 后退导航 */
        navigateBack() {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.currentPath = this.browsingHistory[this.historyIndex];
            }
        },

        /** 前进导航 */
        navigateForward() {
            if (this.historyIndex < this.browsingHistory.length - 1) {
                this.historyIndex++;
                this.currentPath = this.browsingHistory[this.historyIndex];
            }
        },

        /** 加载文件列表 */
        async loadFileList() {
            if (this.directoryCache[this.currentPath]) {
                this.files = this.directoryCache[this.currentPath];
                return;
            }
            this.loading = true;
            this.error = null;
            
            try {
                // 获取 S3 文件列表
                const command = new ListObjectsV2Command({
                    Bucket: process.env.VUE_APP_S3_BUCKET,
                    Prefix: this.currentPath,
                    Delimiter: '/',
                });
                const s3Response = await this.s3Client.send(command);
            
                // 处理目录
                const dirs = (s3Response.CommonPrefixes || []).map((prefix) => {
                    const parts = prefix.Prefix.split('/').filter((p) => p);
                    return {
                        Key: prefix.Prefix,
                        IsDirectory: true,
                        name: parts[parts.length - 1] || '',
                    };
                });
            
                // 处理文件
                const files = (s3Response.Contents || [])
                    .filter((file) => !file.Key.endsWith('/'))
                    .map((file) => {
                        const parts = file.Key.split('/').filter((p) => p);
                        const fileName = parts.pop() || '';
                        const name = fileName.replace(/\.[^.]+$/, ''); // 移除扩展名
                        const author = parts[parts.length - 1]; // 作者是最后一个目录名
            
                        return {
                            Key: file.Key,
                            IsDirectory: false,
                            name,
                            author,
                            Size: file.Size,
                            LastModified: file.LastModified?.toISOString(),
                            thumbnailUrl: `${process.env.IMG_CDN}/${process.env.GH_OWNER}/${process.env.GH_REPO}/${encodeURIComponent(author)}/${encodeURIComponent(name)}.jpg`,
                            videoUrl: `${process.env.VUE_APP_S3_ENDPOINT.replace(process.env.VUE_APP_S3_DOMAIN, process.env.VUE_APP_S3_CUSTOM_DOMAIN)}/${process.env.VUE_APP_S3_BUCKET}/${encodeURIComponent(file.Key)}`,
                            views: null,
                            duration: null
                        };
                    });
            
                // 收集所有作者 - 不过滤任何作者
                const authors = [...new Set(files.map(file => file.author))].filter(author => author);
            
                // 获取视频元数据
                const metadata = {};
                
                // 将作者分批处理，每批3个
                for (let i = 0; i < authors.length; i += 3) {
                    const batch = authors.slice(i, i + 3);
                    await Promise.all(batch.map(async (author) => {
                        try {
                            // 使用 fetchWithRetry 替代普通的 fetch
                            const data = await fetchWithRetry(`/api/xovideos?author=${encodeURIComponent(author)}`);
                            if (data.status === 'success') {
                                data.data.forEach(item => {
                                    const key = `${item.author}/${item.video_title}`;
                                    metadata[key] = {
                                        views: item.video_views,
                                        duration: item.duration
                                    };
                                });
                            }
                        } catch (error) {
                            console.error(`获取作者 ${author} 的元数据失败:`, error);
                        }
                    }));
                }
            
                // 匹配元数据到文件
                files.forEach(file => {
                    const key = `${file.author}/${file.name}`;
                    if (metadata[key]) {
                        file.views = metadata[key].views;
                        file.duration = metadata[key].duration;
                    }
                });
            
                // 缓存并更新文件列表
                this.directoryCache[this.currentPath] = [...dirs, ...files];
                this.files = this.directoryCache[this.currentPath];
            } catch (error) {
                console.error('加载文件列表失败:', error);
                this.error = `加载失败: ${error.message}`;
            } finally {
                this.loading = false;
            }
        },

        /** 数组分块方法 */
        chunkArray(array, size) {
            const result = [];
            for (let i = 0; i < array.length; i += size) {
                result.push(array.slice(i, i + size));
            }
            return result;
        },

        /** 加载初始数据 */
        async loadInitialData() {
            await this.loadFileList();
        },

        /** 更新浏览器 URL */
        updateBrowserUrl() {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('path', this.currentPath);
            window.history.replaceState({}, '', newUrl.toString());
        },

        /** 处理文件点击 */
        handleFileClick(file) {
            if (file.IsDirectory) {
                const newPath = file.Key.replace(/\/?$/, '/');
                this.updateHistory(newPath);
                this.currentPath = newPath;
            } else {
                this.currentVideo = {
                    url: file.videoUrl,
                    title: file.name, // 使用预计算的 name
                    key: file.Key,
                };
                this.videoPlayerVisible = true;
            }
        },

        /** 关闭视频播放器 */
        closeVideoPlayer() {
            this.videoPlayerVisible = false;
            this.currentVideo = null;
        },

        /** 格式化文件大小 */
        formatSize(bytes) {
            if (typeof bytes !== 'number') return '0 B';
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
            if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
            return `${(bytes / 1073741824).toFixed(1)} GB`;
        },

        /** 格式化日期 */
        formatDate(timestamp) {
            try {
                const date = new Date(timestamp);
                return date.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                }).replace(/\//g, '-');
            } catch (e) {
                return 'N/A';
            }
        },

        /** 处理鼠标按钮事件 */
        handleMouseButtons(event) {
            if (event.button === 3) {
                this.navigateBack();
            } else if (event.button === 4) {
                this.navigateForward();
            }
        },
    }
};