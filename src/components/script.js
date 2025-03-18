import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

// 添加API请求缓存
const apiCache = {};

// 添加下划线前缀，告诉ESLint这是一个允许未使用的变量
// 或者直接在函数内部使用该函数
async function _fetchWithRetry(url, options = {}, retries = 2, delay = 500) {
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
        return _fetchWithRetry(url, options, retries - 1, delay * 1.5);
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
            searchQuery: '',
            searchResults: [],
            searchLoading: false,
            searchTimeout: null,
            searchCache: {},
            isSearchActive: false,
            videoMetadata: [], // 存储所有视频元数据
            videoMetadataByAuthor: {}, // 按作者分组的视频元数据
            isDevelopment: process.env.NODE_ENV === 'development',
            authorDirectories: [], // 存储作者目录搜索结果
            nonAuthorResults: [], // 存储非作者目录搜索结果
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

        /** 处理搜索输入 */
        handleSearchInput() {
            if (this.searchQuery.length >= 1) { // 修改为1个字符就开始搜索
                this.performSearch();
            } else {
                this.clearSearch();
            }
            // 清除之前的定时器
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            // 如果搜索框为空，清除搜索结果
            if (!this.searchQuery.trim()) {
                this.clearSearch();
                return;
            }

            // 设置定时器，防止频繁搜索
            this.searchTimeout = setTimeout(() => {
                this.performSearch();
            }, 300);
        },

        /** 执行搜索 */
        async performSearch() {
            if (!this.searchQuery || this.searchQuery.trim().length === 0) {
                this.clearSearch();
                return;
            }

            const query = this.searchQuery.trim().toLowerCase();

            try {
                // 搜索S3文件
                const s3Results = await this.searchS3Files(query);

                // 搜索视频元数据
                const metadataResults = await this.searchVideoMetadata(query);

                // 合并结果
                const combinedResults = [...s3Results, ...metadataResults];

                // 分离作者目录和其他结果
                this.authorDirectories = combinedResults.filter(result =>
                    result.IsDirectory &&
                    (result.name.toLowerCase().includes(query) ||
                        (result.author && result.author.toLowerCase().includes(query)))
                );

                this.nonAuthorResults = combinedResults.filter(result =>
                    !this.authorDirectories.some(dir => dir.Key === result.Key)
                );

                // 更新搜索结果
                this.searchResults = [...this.authorDirectories, ...this.nonAuthorResults];
                this.isSearchActive = this.searchResults.length > 0;

            } catch (error) {
                console.error('搜索失败:', error);
            }
        },
        /** 搜索 S3 文件 */
        async searchS3Files(query) {
            // 如果目录缓存为空，先加载根目录
            if (Object.keys(this.directoryCache).length === 0) {
                await this.loadFileList();
            }

            // 从缓存的目录中搜索
            let results = [];

            // 遍历所有缓存的目录
            for (const [path, files] of Object.entries(this.directoryCache)) {
                // 过滤匹配的文件和目录
                const matchedFiles = files.filter(file => {
                    // 获取文件名和完整路径
                    const fileName = file.Key.split('/').pop().toLowerCase();
                    const fullPath = file.Key.toLowerCase();
                    const authorName = file.author ? file.author.toLowerCase() : '';

                    // 检查文件名、路径和其他属性是否包含搜索词
                    // 使用 indexOf 替代 includes 以支持单字搜索
                    return fileName.indexOf(query) !== -1 ||
                        fullPath.indexOf(query) !== -1 ||
                        authorName.indexOf(query) !== -1;
                });

                // 格式化结果，保留原始属性
                const formattedResults = matchedFiles.map(file => {
                    return {
                        ...file,
                        path: path || '/',
                        type: file.IsDirectory ? 'directory' : this.getFileType(file.Key.split('/').pop())
                    };
                });

                results = [...results, ...formattedResults];
            }

            // 如果结果少于10个，尝试从S3加载更多目录
            if (results.length < 10) {
                try {
                    // 尝试加载更多目录
                    const pathsToLoad = this.findPotentialPathsToLoad(query);
                    for (const pathToLoad of pathsToLoad) {
                        if (!this.directoryCache[pathToLoad]) {
                            await this.loadDirectoryContent(pathToLoad);

                            // 在新加载的目录中搜索
                            if (this.directoryCache[pathToLoad]) {
                                const newFiles = this.directoryCache[pathToLoad].filter(file => {
                                    const fileName = file.Key.split('/').pop().toLowerCase();
                                    const fullPath = file.Key.toLowerCase();
                                    const authorName = file.author ? file.author.toLowerCase() : '';

                                    // 使用 indexOf 替代 includes 以支持单字搜索
                                    return fileName.indexOf(query) !== -1 ||
                                        fullPath.indexOf(query) !== -1 ||
                                        authorName.indexOf(query) !== -1;
                                });

                                const newFormattedResults = newFiles.map(file => {
                                    return {
                                        ...file,
                                        path: pathToLoad || '/',
                                        type: file.IsDirectory ? 'directory' : this.getFileType(file.Key.split('/').pop())
                                    };
                                });

                                results = [...results, ...newFormattedResults];
                            }
                        }
                    }
                } catch (error) {
                    console.error('加载更多目录失败:', error);
                }
            }

            // 限制结果数量
            return results.slice(0, 50);
        },

        /** 搜索视频元数据 */
        searchVideoMetadata(query) {
            if (!query || query.length < 1) { // 修改为1个字符就开始搜索
                return [];
            }

            query = query.toLowerCase();

            // 从缓存的元数据中搜索
            return this.videoMetadata.filter(video => {
                const title = (video.video_title || '').toLowerCase();
                const author = (video.author || '').toLowerCase();

                // 使用 indexOf 替代 includes 以支持单字搜索
                return title.indexOf(query) !== -1 || author.indexOf(query) !== -1;
            }).map(video => {
                // 构建缩略图URL
                const imgCdn = process.env.VUE_APP_IMG_CDN || '';
                const ghOwner = process.env.VUE_APP_GH_OWNER || '';
                const ghRepo = process.env.VUE_APP_GH_REPO || '';
                const thumbnailUrl = `${imgCdn}/${ghOwner}/${ghRepo}/${encodeURIComponent(video.author || '')}/${encodeURIComponent(video.video_title || '')}.jpg`;

                return {
                    ...video,
                    type: 'video',
                    name: video.video_title,
                    thumbnail_url: thumbnailUrl
                };
            });
        },

    /** 查找可能包含搜索词的路径 */
    findPotentialPathsToLoad(query) {
        // 这里可以添加一些启发式方法来猜测可能包含搜索词的路径
        // 例如，如果搜索词是"JK"，可能需要加载 "/XOVideos/" 目录
        const potentialPaths = [];

        // 添加一些常见目录
        potentialPaths.push('');  // 根目录
        potentialPaths.push('XOVideos/');
        potentialPaths.push('videos/');
        potentialPaths.push('pornhub/');

        // 如果搜索词可能是作者名，尝试加载对应的作者目录
        if (query.length > 1) {
            potentialPaths.push(`XOVideos/${query}/`);
            potentialPaths.push(`videos/${query}/`);
        }

        return potentialPaths;
    },

    /** 加载指定目录内容 */
    async loadDirectoryContent(path) {
        try {
            // 获取 S3 文件列表
            const command = new ListObjectsV2Command({
                Bucket: process.env.VUE_APP_S3_BUCKET,
                Prefix: path,
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
                    };
                });

            // 缓存结果
            this.directoryCache[path] = [...dirs, ...files];

            return this.directoryCache[path];
        } catch (error) {
            console.error(`加载目录 ${path} 失败:`, error);
            return [];
        }
    },
    /** 本地搜索视频元数据 */
    async searchLocalVideoMetadata(query) {
        // 如果没有加载过视频元数据，先加载
        if (!this.videoMetadata) {
            try {
                const response = await fetch('/api/xovideos');
                const data = await response.json();

                if (data.status === 'success' && Array.isArray(data.data)) {
                    this.videoMetadata = data.data;
                } else {
                    return [];
                }
            } catch (error) {
                console.error('加载视频元数据失败:', error);
                return [];
            }
        }

        // 在本地元数据中搜索
        return this.videoMetadata.filter(video => {
            const title = (video.video_title || '').toLowerCase();
            const author = (video.author || '').toLowerCase();
            return title.includes(query) || author.includes(query);
        }).map(video => ({
            ...video,
            type: 'video',
            name: video.video_title
        }));
    },
    /** 清除搜索 */
    clearSearch() {
        this.searchQuery = '';
        this.searchResults = [];
        this.isSearchActive = false;
    },

    /** 处理搜索结果点击 */
    handleSearchResultClick(result) {
        if (result.IsDirectory) {
            // 如果是目录，导航到该目录
            this.currentPath = result.path + (result.path.endsWith('/') ? '' : '/') + result.name;
            this.clearSearch();
        } else if (result.type === 'video') {
            // 如果是视频元数据，尝试在S3中查找对应的视频
            this.searchAndPlayVideo(result);
        } else {
            // 如果是文件，处理文件点击
            this.handleFileClick(result);
            this.clearSearch();
        }
    },

    /** 搜索并播放视频 */
    async searchAndPlayVideo(videoMetadata) {
        try {
            // 获取视频标题和作者
            const videoTitle = videoMetadata.video_title || '';
            const author = videoMetadata.author || '';

            console.log(`尝试查找视频: "${videoTitle}" by ${author}`);

            let videoFile = null;

            // 1. 首先尝试在作者目录中查找
            if (author) {
                // 尝试多个可能的作者目录路径

                // 如果作者目录未缓存，尝试加载
                if (!this.directoryCache[author]) {
                    try {
                        console.log(`尝试加载作者目录: ${author}`);
                        await this.loadDirectoryContent(author);
                    } catch (error) {
                        console.log(`作者目录 ${author} 不存在或无法访问`);
                    }
                }

                // 在作者目录中查找
                if (this.directoryCache[author]) {
                    const authorFiles = this.directoryCache[author];
                    // 使用更宽松的匹配逻辑
                    videoFile = this.findBestMatchingVideo(authorFiles, videoTitle);
                    if (videoFile) {
                        console.log(`在目录 ${author} 中找到匹配视频: ${videoFile.Key}`);
                    }
                }
            }


            // 2. 如果在作者目录中没找到，尝试在所有已缓存的目录中查找
            if (!videoFile) {
                console.log(`在作者目录中未找到视频，尝试在所有缓存目录中查找`);

                for (const [path, files] of Object.entries(this.directoryCache)) {
                    const found = this.findBestMatchingVideo(files, videoTitle);
                    if (found) {
                        videoFile = found;
                        console.log(`在目录 ${path} 中找到匹配视频: ${found.Key}`);
                        break;
                    }
                }
            }

            // 3. 如果仍然没找到，尝试加载更多目录
            if (!videoFile) {
                console.log(`在已缓存目录中未找到视频，尝试加载更多目录`);

                if (!this.directoryCache[author]) {
                    try {
                        console.log(`尝试加载目录: ${author}`);
                        await this.loadDirectoryContent(author);

                        // 在新加载的目录中查找
                        if (this.directoryCache[author]) {
                            const found = this.findBestMatchingVideo(this.directoryCache[author], videoTitle);
                            if (found) {
                                videoFile = found;
                                console.log(`在新加载的目录 ${author} 中找到匹配视频: ${found.Key}`);
                            }
                        }
                    } catch (error) {
                        console.log(`目录 ${author} 不存在或无法访问`);
                    }
                } else {
                    // 目录已缓存，再次检查
                    const found = this.findBestMatchingVideo(this.directoryCache[author], videoTitle);
                    if (found) {
                        videoFile = found;
                        console.log(`在已缓存目录 ${author} 中找到匹配视频: ${found.Key}`);
                    }
                }
            }


            // 4. 如果仍然没找到，尝试递归搜索子目录
            if (!videoFile) {
                console.log(`在常见目录中未找到视频，尝试递归搜索子目录`);

                // 获取所有已缓存的目录
                const cachedDirs = Object.keys(this.directoryCache)
                    .filter(path => path.endsWith('/'));

                // 遍历每个目录，查找子目录
                for (const dir of cachedDirs) {
                    if (this.directoryCache[dir]) {
                        const subDirs = this.directoryCache[dir]
                            .filter(item => item.IsDirectory)
                            .map(item => item.Key);

                        // 加载并搜索每个子目录
                        for (const subDir of subDirs) {
                            if (!this.directoryCache[subDir]) {
                                try {
                                    console.log(`尝试加载子目录: ${subDir}`);
                                    await this.loadDirectoryContent(subDir);

                                    if (this.directoryCache[subDir]) {
                                        const found = this.findBestMatchingVideo(this.directoryCache[subDir], videoTitle);
                                        if (found) {
                                            videoFile = found;
                                            console.log(`在子目录 ${subDir} 中找到匹配视频: ${found.Key}`);
                                            break;
                                        }
                                    }
                                } catch (error) {
                                    console.log(`子目录 ${subDir} 不存在或无法访问`);
                                }
                            }
                        }

                        if (videoFile) break;
                    }
                }
            }

            // 如果找到了视频文件，确保它有正确的 videoUrl
            if (videoFile) {
                // 确保视频文件有 videoUrl
                if (!videoFile.videoUrl) {
                    // 构建视频URL
                    const s3Endpoint = process.env.VUE_APP_S3_ENDPOINT || '';
                    const s3Domain = process.env.VUE_APP_S3_DOMAIN || '';
                    const s3CustomDomain = process.env.VUE_APP_S3_CUSTOM_DOMAIN || s3Domain;
                    videoFile.videoUrl = s3Endpoint.replace(s3Domain, s3CustomDomain) + '/' + encodeURIComponent(videoFile.Key);
                    console.log(`为视频构建URL: ${videoFile.videoUrl}`);
                }

                this.handleFileClick(videoFile);
                this.clearSearch();
            } else {
                // 如果没找到，显示提示
                console.error(`未找到视频文件: ${videoTitle}`);
                alert(`未找到视频文件: ${videoTitle}\n\n请尝试浏览到对应作者目录手动查找。`);
            }
        } catch (error) {
            console.error('搜索视频文件失败:', error);
        }
    },

    /** 查找最佳匹配的视频文件 */
    findBestMatchingVideo(files, videoTitle) {
        if (!files || !videoTitle) return null;

        // 过滤出视频文件
        const videoFiles = files.filter(file => {
            const fileName = file.Key.split('/').pop();
            return !file.IsDirectory && this.getFileType(fileName) === 'video';
        });

        if (videoFiles.length === 0) return null;

        // 准备用于匹配的标题
        const normalizedTitle = videoTitle.toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "") // 移除标点符号
            .replace(/\s+/g, " ") // 规范化空格
            .trim();

        console.log(`规范化后的标题: "${normalizedTitle}"`);

        // 1. 尝试精确匹配
        let match = videoFiles.find(file => {
            const fileName = file.Key.split('/').pop().toLowerCase();
            const normalizedFileName = fileName
                .replace(/\.[^.]+$/, '') // 移除扩展名
                .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "") // 移除标点符号
                .replace(/\s+/g, " ") // 规范化空格
                .trim();

            return normalizedFileName.includes(normalizedTitle) || normalizedTitle.includes(normalizedFileName);
        });

        if (match) {
            console.log(`找到精确匹配: ${match.Key}`);
            return match;
        }

        // 2. 如果没有精确匹配，尝试关键词匹配
        // 提取标题中的关键词（长度大于2的词）
        const keywords = normalizedTitle.split(' ').filter(word => word.length > 2);

        if (keywords.length > 0) {
            console.log(`提取的关键词: ${keywords.join(', ')}`);

            // 查找包含最多关键词的文件
            let bestMatchCount = 0;
            let bestMatch = null;

            for (const file of videoFiles) {
                const fileName = file.Key.split('/').pop().toLowerCase();
                const normalizedFileName = fileName
                    .replace(/\.[^.]+$/, '') // 移除扩展名
                    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "") // 移除标点符号
                    .replace(/\s+/g, " ") // 规范化空格
                    .trim();

                let matchCount = 0;
                let matchedKeywords = [];

                for (const keyword of keywords) {
                    if (normalizedFileName.includes(keyword)) {
                        matchCount++;
                        matchedKeywords.push(keyword);
                    }
                }

                if (matchCount > bestMatchCount) {
                    bestMatchCount = matchCount;
                    bestMatch = file;
                    console.log(`新的最佳匹配: ${file.Key}，匹配了 ${matchCount} 个关键词: ${matchedKeywords.join(', ')}`);
                }
            }

            // 如果至少匹配了一个关键词，就认为是匹配的
            if (bestMatchCount > 0) {
                console.log(`最终关键词匹配: ${bestMatch.Key}，匹配了 ${bestMatchCount} 个关键词`);
                return bestMatch;
            }
        }

        // 3. 如果关键词匹配也失败，尝试模糊匹配（取第一个视频文件）
        if (videoFiles.length > 0) {
            console.log(`没有找到关键词匹配，使用模糊匹配: ${videoFiles[0].Key}`);
            return videoFiles[0];
        }

        return null;
    },

    /** 获取文件类型 */
    getFileType(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

        if (videoExtensions.includes(extension)) {
            return 'video';
        } else if (imageExtensions.includes(extension)) {
            return 'image';
        } else {
            return 'file';
        }
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

                    // 修复封面图片URL构建
                    const imgCdn = process.env.VUE_APP_IMG_CDN || '';
                    const ghOwner = process.env.VUE_APP_GH_OWNER || '';
                    const ghRepo = process.env.VUE_APP_GH_REPO || '';
                    const thumbnailUrl = `${imgCdn}/${ghOwner}/${ghRepo}/${encodeURIComponent(author)}/${encodeURIComponent(name)}.jpg`;

                    // 修复视频URL域名替换
                    const s3Endpoint = process.env.VUE_APP_S3_ENDPOINT || '';
                    const s3Domain = process.env.VUE_APP_S3_DOMAIN || '';
                    const s3CustomDomain = process.env.VUE_APP_S3_CUSTOM_DOMAIN || s3Domain;
                    const videoUrl = s3Endpoint.replace(s3Domain, s3CustomDomain) + '/' + encodeURIComponent(file.Key);

                    return {
                        Key: file.Key,
                        IsDirectory: false,
                        name,
                        author,
                        Size: file.Size,
                        LastModified: file.LastModified?.toISOString(),
                        thumbnailUrl,
                        videoUrl,
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
                        // 修复：处理特殊字符和空格，确保URL编码正确
                        const safeAuthor = encodeURIComponent(author.trim());

                        // 使用完整的API URL，确保请求正确路由
                        // 检测当前环境是开发环境还是生产环境
                        const baseUrl = process.env.NODE_ENV === 'development'
                            ? ''
                            : window.location.origin;
                        const apiUrl = `${baseUrl}/api/xovideos?author=${safeAuthor}`;

                        const response = await fetch(apiUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json',
                                'Cache-Control': 'no-cache'
                            },
                        });

                        // 检查响应状态
                        if (!response.ok) {
                            console.warn(`获取作者 ${author} 的元数据失败: HTTP ${response.status}`);
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        const data = await response.json();
                        console.log(`API响应:`, data); // 添加日志

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
                        console.error(`获取元数据失败: ${author}`, error);
                    }
                }));

                // 添加小延迟，避免请求过于密集
                if (i + 3 < authors.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
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
        try {
            // 并行加载文件列表和视频元数据
            await Promise.all([
                this.loadFileList(),
                this.loadAllVideoMetadata()
            ]);
        } catch (error) {
            console.error('加载初始数据失败:', error);
            this.error = `加载失败: ${error.message}`;
        }
    },

    /** 加载所有视频元数据 */
    async loadAllVideoMetadata() {
        try {
            // 不带author参数请求所有视频元数据
            const apiUrl = '/api/xovideos';
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && Array.isArray(data.data)) {
                this.videoMetadata = data.data;

                // 按作者分组
                this.videoMetadataByAuthor = {};
                for (const video of data.data) {
                    const author = video.author || '未知作者';
                    if (!this.videoMetadataByAuthor[author]) {
                        this.videoMetadataByAuthor[author] = [];
                    }
                    this.videoMetadataByAuthor[author].push(video);
                }
            } else {
                console.error('API返回格式错误:', data);
            }
        } catch (error) {
            console.error('加载视频元数据失败:', error);
        }
    },

    /** 检查是否是作者目录 */
    isAuthorDirectory(dirName) {
        return this.videoMetadataByAuthor[dirName] !== undefined;
    },

    /** 预加载作者视频元数据 */
    preloadAuthorVideos(author) {
        // 如果已经有缓存，不需要重新加载
        if (this.videoMetadataByAuthor[author] && this.videoMetadataByAuthor[author].length > 0) {
            console.log(`使用缓存的 ${author} 视频元数据，共 ${this.videoMetadataByAuthor[author].length} 条`);
            return;
        }

        // 否则从API加载
        this.loadAuthorVideos(author);
    },

    /** 从API加载作者视频 */
    async loadAuthorVideos(author) {
        try {
            const apiUrl = `/api/xovideos?author=${encodeURIComponent(author)}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && Array.isArray(data.data)) {
                // 更新缓存
                this.videoMetadataByAuthor[author] = data.data;
            }
        } catch (error) {
            console.error(`加载 ${author} 视频元数据失败:`, error);
        }
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

    /** 格式化文件大小 */
    formatSize(bytes) {
        if (typeof bytes !== 'number') return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
        return `${(bytes / 1073741824).toFixed(1)} GB`;
    },

    /** 处理鼠标按钮事件 */
    handleMouseButtons(event) {
        if (event.button === 3) {
            this.navigateBack();
        } else if (event.button === 4) {
            this.navigateForward();
        }
    },

    /** 导航到根目录 */
    navigateToRoot() {
        this.updateHistory('');
        this.currentPath = '';
    },

    /** 面包屑导航 */
    navigateTo(index) {
        const newPath = this.pathParts.slice(0, index + 1).join('/') + '/';
        this.updateHistory(newPath);
        this.currentPath = newPath;
    },
    /** 加载更多目录用于搜索 */
    async loadMoreForSearch() {
        this.searchLoading = true;

        try {
            // 尝试加载一些常见目录
            const commonDirs = [
                'XOVideos/',
                'videos/',
                'pornhub/',
                'SLRabbit/'
            ];

            for (const dir of commonDirs) {
                if (!this.directoryCache[dir]) {
                    await this.loadDirectoryContent(dir);
                }
            }

            // 重新执行搜索
            await this.performSearch();
        } catch (error) {
            console.error('加载更多目录失败:', error);
        } finally {
            this.searchLoading = false;
        }
    },

    /** 高亮显示匹配原因（用于调试） */
    highlightMatch(result, query) {
        // 检查文件名匹配
        const fileName = (result.name || result.video_title || '').toLowerCase();
        if (fileName.includes(query.toLowerCase())) {
            return `文件名包含 "${query}"`;
        }

        // 检查路径匹配
        const fullPath = (result.Key || '').toLowerCase();
        if (fullPath.includes(query.toLowerCase())) {
            return `路径包含 "${query}"`;
        }

        // 检查作者匹配
        const author = (result.author || '').toLowerCase();
        if (author.includes(query.toLowerCase())) {
            return `作者包含 "${query}"`;
        }

        return '未知匹配原因';
    },
},
};