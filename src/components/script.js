import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const apiCache = {};

async function _fetchWithRetry(url, options = {}, retries = 2, delay = 500) {
    if (apiCache[url]) {
        return apiCache[url];
    }
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        apiCache[url] = data;
        return data;
    } catch (error) {
        if (retries <= 0) {
            throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        return _fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
}

export default {
    data() {
        return {
            currentPath: "",
            files: [],
            loading: false,
            error: null,
            browsingHistory: [],
            historyIndex: -1,
            scrollObserver: null,
            directoryCache: {},
            videoPlayerVisible: false,
            currentVideo: null,
            searchQuery: "",
            searchResults: [],
            searchLoading: false,
            searchTimeout: null,
            searchCache: {},
            isSearchActive: false,
            videoMetadata: [],
            videoMetadataByAuthor: {},
            isDevelopment: process.env.NODE_ENV === "development",
            authorDirectories: [],
            videoFiles: [],
            showBackToTop: false,
        };
    },

    computed: {
        pathParts() {
            return this.currentPath.split("/").filter((p) => p);
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
        window.addEventListener("mouseup", this.handleMouseButtons);
        this.initPathFromUrl();
        await this.loadInitialData();
    },

    mounted() {
        this.applyDarkModePreference();
        window.addEventListener('scroll', this.handleScroll);
    },

    beforeUnmount() {
        window.removeEventListener("mouseup", this.handleMouseButtons);
        window.removeEventListener('scroll', this.handleScroll);
        this.scrollObserver?.disconnect();
    },

    methods: {
        // 处理滚动事件，显示/隐藏回到顶部按钮
        handleScroll() {
            this.showBackToTop = window.scrollY > 300;
        },
        
        // 滚动到顶部
        scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        },
        
        // 获取目录中的文件数量
        getDirectoryFileCount(dirKey) {
            // 确保目录键以斜杠结尾
            const dirPath = dirKey.endsWith("/") ? dirKey : dirKey + "/";
            if (this.directoryCache[dirPath]) {
                // 只计算非目录的文件
                return this.directoryCache[dirPath].filter(f => !f.IsDirectory).length;
            }
            // 如果目录缓存中没有该目录，尝试从视频元数据中获取
            if (this.videoMetadataByAuthor) {
                // 从dirKey中提取作者名称
                const authorName = dirKey.split('/')[0];
                if (this.videoMetadataByAuthor[authorName]) {
                    return this.videoMetadataByAuthor[authorName].length;
                }
            }
            return 0;
        },
        
        // 获取目录中最近的更新日期
        getDirectoryLatestUpdate(dirKey) {
            // 确保目录键以斜杠结尾
            const dirPath = dirKey.endsWith("/") ? dirKey : dirKey + "/";
            if (this.directoryCache[dirPath]) {
                // 过滤出非目录文件并按日期排序
                const files = this.directoryCache[dirPath].filter(f => !f.IsDirectory && f.LastModified);
                if (files.length > 0) {
                    // 按日期降序排序
                    files.sort((a, b) => {
                        return new Date(b.LastModified) - new Date(a.LastModified);
                    });
                    // 返回最新的日期
                    return this.formatDate(files[0].LastModified);
                }
            }
            return "暂无更新";
        },
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

        handleSearchInput() {
            if (this.searchQuery.length >= 1) {
                if (this.searchTimeout) {
                    clearTimeout(this.searchTimeout);
                }
                this.searchTimeout = setTimeout(() => {
                    this.performSearch();
                }, 300);
            } else {
                this.clearSearch();
            }
        },

        async performSearch() {
            if (!this.searchQuery || this.searchQuery.trim().length === 0) {
                this.clearSearch();
                return;
            }
            
            const query = this.searchQuery.trim().toLowerCase();
            
            try {
                // 如果目录缓存为空，先加载根目录
                if (Object.keys(this.directoryCache).length === 0) {
                    await this.loadFileList();
                }
                
                // 搜索S3文件
                const s3Results = await this.searchS3Files(query);
                
                // 搜索视频元数据
                const metadataResults = await this.searchVideoMetadata(query);
                
                // 合并结果
                const allResults = [...s3Results, ...metadataResults];
                
                // 分离作者目录和视频文件
                this.authorDirectories = allResults.filter(result => 
                    result.IsDirectory || 
                    (result.author && !result.video_title && !result.Key)
                );
                
                this.videoFiles = allResults.filter(result => 
                    !result.IsDirectory && 
                    (this.getFileType(result.Key?.split('/').pop() || result.name || '') === 'video' || 
                     result.type === 'video')
                );
                
                // 更新搜索结果
                this.searchResults = allResults;
                this.isSearchActive = this.searchResults.length > 0;
            } catch (error) {
                console.error("搜索失败:", error);
            }
        },

        async searchS3Files(query) {
            // 如果目录缓存为空，先加载根目录
            if (Object.keys(this.directoryCache).length === 0) {
                await this.loadFileList();
            }
            
            let results = [];
            
            // 遍历所有缓存的目录
            for (const [path, files] of Object.entries(this.directoryCache)) {
                // 过滤匹配的文件和目录
                const matchedFiles = files.filter(file => {
                    // 获取文件名和完整路径
                    const fileName = file.Key.split('/').pop().toLowerCase();
                    const fullPath = file.Key.toLowerCase();
                    const authorName = file.author ? file.author.toLowerCase() : '';
                    
                    return fileName.includes(query) || 
                           fullPath.includes(query) || 
                           authorName.includes(query);
                });
                
                // 格式化结果
                const formattedResults = matchedFiles.map(file => ({
                    ...file,
                    path: path || '/',
                    type: file.IsDirectory ? 'directory' : this.getFileType(file.Key.split('/').pop()),
                    name: file.name || file.Key.split('/').pop() // 确保所有结果都有name属性
                }));
                
                results = [...results, ...formattedResults];
            }
            
            // 添加作者目录到搜索结果
            if (this.videoMetadataByAuthor) {
                for (const author in this.videoMetadataByAuthor) {
                    if (author.toLowerCase().includes(query)) {
                        // 检查这个作者是否已经在结果中
                        const authorExists = results.some(r => 
                            r.IsDirectory && 
                            (r.name === author || r.Key === author + '/')
                        );
                        
                        if (!authorExists) {
                            // 添加作者目录到结果中
                            results.push({
                                Key: author + '/',
                                IsDirectory: true,
                                name: author,
                                path: '',
                                type: 'directory',
                                author: author
                            });
                        }
                    }
                }
            }
            
            return results.slice(0, 50);
        },

        searchVideoMetadata(query) {
            if (!query || query.length < 1) {
                return [];
            }
            query = query.toLowerCase();
            return this.videoMetadata
                .filter((video) => {
                    const title = (video.video_title || "").toLowerCase();
                    const author = (video.author || "").toLowerCase();
                    return title.includes(query) || author.includes(query);
                })
                .map((video) => {
                    const imgCdn = process.env.VUE_APP_IMG_CDN || "";
                    const ghOwner = process.env.VUE_APP_GH_OWNER || "";
                    const ghRepo = process.env.VUE_APP_GH_REPO || "";
                    const thumbnailUrl = `${imgCdn}/${ghOwner}/${ghRepo}/${encodeURIComponent(
                        video.author || ""
                    )}/${encodeURIComponent(video.video_title || "")}.jpg`;
                    return {
                        ...video,
                        type: "video",
                        name: video.video_title,
                        thumbnail_url: thumbnailUrl,
                        Size: video.Size || 104857600,
                        LastModified: video.upload_date || new Date().toISOString(),
                        views: video.video_views || 0,
                        duration: video.duration || "N/A",
                        IsDirectory: false,
                    };
                });
        },

        clearSearch() {
            this.searchQuery = "";
            this.searchResults = [];
            this.authorDirectories = [];
            this.videoFiles = [];
            this.isSearchActive = false;
        },

        handleSearchResultClick(result) {
            if (result.IsDirectory) {
                // 修改：直接使用handleFileClick处理目录点击，确保行为一致
                const newPath = result.path + (result.path.endsWith("/") ? "" : "/") + result.name;
                // 创建一个符合handleFileClick期望的对象
                const dirObject = {
                    Key: newPath,
                    IsDirectory: true
                };
                this.handleFileClick(dirObject);
                this.clearSearch();
            } else if (result.type === "video") {
                this.searchAndPlayVideo(result);
                // 不清除搜索状态，保持在搜索结果页
            } else {
                this.handleFileClick(result);
                // 不清除搜索状态，保持在搜索结果页
            }
        },

        async searchAndPlayVideo(videoMetadata) {
            try {
                const videoTitle = videoMetadata.video_title || videoMetadata.name || "";
                const author = videoMetadata.author || "";
                
                // 如果视频元数据中已经有videoUrl，直接使用
                if (videoMetadata.videoUrl) {
                    this.currentVideo = {
                        url: videoMetadata.videoUrl,
                        title: videoTitle,
                        key: videoMetadata.Key || `${author}/${videoTitle}`
                    };
                    this.videoPlayerVisible = true;
                    return;
                }
                
                // 如果是从视频元数据搜索结果点击的，需要查找对应的视频文件
                if (videoMetadata.type === "video" && !videoMetadata.videoUrl) {
                    // 首先尝试在缓存中查找视频文件
                    let videoFile = null;
                    
                    // 构建可能的视频路径，确保添加正确的文件扩展名
                    let possibleKey = `${author}/${videoTitle}`;
                    // 检查标题是否已经包含扩展名
                    if (!possibleKey.endsWith(".mp4") && !possibleKey.endsWith(".webm") && 
                        !possibleKey.endsWith(".mov") && !possibleKey.endsWith(".avi") && 
                        !possibleKey.endsWith(".mkv") && !possibleKey.endsWith(".ogg")) {
                        possibleKey += ".mp4";
                    }
                    
                    // 创建一个模拟的文件对象，使用与正常浏览相同的URL生成逻辑
                    const s3Endpoint = process.env.VUE_APP_S3_ENDPOINT || "";
                    const s3Domain = process.env.VUE_APP_S3_DOMAIN || "";
                    const s3CustomDomain = process.env.VUE_APP_S3_CUSTOM_DOMAIN || s3Domain;
                    const videoUrl = s3Endpoint.replace(s3Domain, s3CustomDomain) + "/" + encodeURIComponent(possibleKey);
                    
                    // 使用与handleFileClick相同的对象结构
                    const fileObject = {
                        Key: possibleKey,
                        name: videoTitle,
                        videoUrl: videoUrl
                    };
                    
                    // 使用与handleFileClick相同的方式设置当前视频
                    this.currentVideo = {
                        url: fileObject.videoUrl,
                        title: fileObject.name,
                        key: fileObject.Key
                    };
                    this.videoPlayerVisible = true;
                    return;
                }
                
                // 首先在作者目录中查找
                if (author) {
                    // 确保作者目录路径格式正确（以斜杠结尾）
                    const authorDirPath = author.endsWith("/") ? author : author + "/";
                    // 检查缓存中是否有该作者目录
                    if (this.directoryCache[authorDirPath]) {
                        videoFile = this.findBestMatchingVideo(this.directoryCache[authorDirPath], videoTitle);
                    }
                    
                    // 如果没找到，尝试其他可能的作者目录路径格式
                    if (!videoFile) {
                        // 尝试不带斜杠的路径
                        const altAuthorPath = author.replace(/\/$/, "");
                        if (this.directoryCache[altAuthorPath]) {
                            videoFile = this.findBestMatchingVideo(this.directoryCache[altAuthorPath], videoTitle);
                        }
                    }
                }
                
                // 如果在作者目录中没找到，在所有缓存的目录中查找
                if (!videoFile) {
                    for (const [path, files] of Object.entries(this.directoryCache)) {
                        // 跳过空路径（根目录）
                        if (path === "") continue;
                        
                        const found = this.findBestMatchingVideo(files, videoTitle);
                        if (found) {
                            videoFile = found;
                            break;
                        }
                    }
                }
                
                // 如果找到了视频文件但没有URL，使用与正常浏览相同的URL生成逻辑
                if (videoFile && !videoFile.videoUrl) {
                    const s3Endpoint = process.env.VUE_APP_S3_ENDPOINT || "";
                    const s3Domain = process.env.VUE_APP_S3_DOMAIN || "";
                    const s3CustomDomain = process.env.VUE_APP_S3_CUSTOM_DOMAIN || s3Domain;
                    videoFile.videoUrl = s3Endpoint.replace(s3Domain, s3CustomDomain) + "/" + encodeURIComponent(videoFile.Key);
                }
                
                if (videoFile) {
                    this.currentVideo = {
                        url: videoFile.videoUrl,
                        title: videoFile.name,
                        key: videoFile.Key
                    };
                    this.videoPlayerVisible = true;
                } else {
                    // 如果仍然找不到，尝试加载作者目录
                    if (author && !this.directoryCache[author + "/"]) {
                        // 临时保存当前路径
                        const currentPathBackup = this.currentPath;
                        // 设置当前路径为作者目录
                        this.currentPath = author + "/";
                        // 加载作者目录内容
                        await this.loadFileList();
                        // 恢复当前路径
                        this.currentPath = currentPathBackup;
                        
                        // 再次尝试查找视频
                        if (this.directoryCache[author + "/"]) {
                            videoFile = this.findBestMatchingVideo(this.directoryCache[author + "/"], videoTitle);
                            if (videoFile) {
                                if (!videoFile.videoUrl) {
                                    const s3Endpoint = process.env.VUE_APP_S3_ENDPOINT || "";
                                    const s3Domain = process.env.VUE_APP_S3_DOMAIN || "";
                                    const s3CustomDomain = process.env.VUE_APP_S3_CUSTOM_DOMAIN || s3Domain;
                                    videoFile.videoUrl = s3Endpoint.replace(s3Domain, s3CustomDomain) + "/" + encodeURIComponent(videoFile.Key);
                                }
                                this.currentVideo = {
                                    url: videoFile.videoUrl,
                                    title: videoFile.name,
                                    key: videoFile.Key
                                };
                                this.videoPlayerVisible = true;
                                return;
                            }
                        }
                    }
                    
                    alert(`未找到视频文件: ${videoTitle}\n请尝试浏览到对应作者目录手动查找。`);
                }
            } catch (error) {
                console.error("搜索视频文件失败:", error);
            }
        },

        findBestMatchingVideo(files, videoTitle) {
            if (!files || !videoTitle) return null;
            const videoFiles = files.filter((file) => {
                const fileName = file.Key.split("/").pop();
                return !file.IsDirectory && this.getFileType(fileName) === "video";
            });
            if (videoFiles.length === 0) return null;
            const normalizedTitle = videoTitle.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim();
            let match = videoFiles.find((file) => {
                const fileName = file.Key.split("/").pop().toLowerCase();
                const normalizedFileName = fileName.replace(/\.[^.]+$/, "").replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim();
                return normalizedFileName.includes(normalizedTitle) || normalizedTitle.includes(normalizedFileName);
            });
            return match || videoFiles[0];
        },

        getFileType(fileName) {
            const extension = fileName.split(".").pop().toLowerCase();
            const videoExtensions = ["mp4", "webm", "ogg", "mov", "avi", "mkv"];
            return videoExtensions.includes(extension) ? "video" : "file";
        },

        applyDarkModePreference() {
            const savedDarkMode = localStorage.getItem("darkMode");
            const isDark = savedDarkMode === "true" || (!savedDarkMode && window.matchMedia("(prefers-color-scheme: dark)").matches);
            document.body.classList.toggle("dark-mode", isDark);
        },

        toggleDarkMode() {
            document.body.classList.toggle("dark-mode");
            localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
        },

        generatePlaceholder(key) {
            const colors = ["#2c3e50", "#34495e", "#7f8c8d", "#95a5a6"];
            const hash = Array.from(key).reduce((acc, char) => char.charCodeAt(0) + (acc << 5) - acc, 0);
            const color = colors[Math.abs(hash) % colors.length];
            return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 16 9' preserveAspectRatio='none'><rect width='16' height='9' fill='${encodeURIComponent(color)}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui, sans-serif' font-size='1.5' fill='%23fff'>${encodeURIComponent(key.split("/").pop()?.substring(0, 12) || "")}</text></svg>`;
        },

        initPathFromUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            const initialPath = urlParams.get("path") || "";
            this.browsingHistory = [initialPath];
            this.historyIndex = 0;
            this.currentPath = initialPath;
        },

        updateHistory(newPath) {
            if (newPath === this.browsingHistory[this.historyIndex]) return;
            this.browsingHistory = [...this.browsingHistory.slice(0, this.historyIndex + 1), newPath];
            this.historyIndex = this.browsingHistory.length - 1;
        },

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
            if (this.directoryCache[this.currentPath]) {
                this.files = this.directoryCache[this.currentPath];
                return;
            }
            this.loading = true;
            this.error = null;
            try {
                const command = new ListObjectsV2Command({
                    Bucket: process.env.VUE_APP_S3_BUCKET,
                    Prefix: this.currentPath,
                    Delimiter: "/",
                });
                const s3Response = await this.s3Client.send(command);
                const dirs = (s3Response.CommonPrefixes || []).map((prefix) => {
                    const parts = prefix.Prefix.split("/").filter((p) => p);
                    return {
                        Key: prefix.Prefix,
                        IsDirectory: true,
                        name: parts[parts.length - 1] || "",
                        author: parts.length > 1 ? parts[parts.length - 2] : "",
                    };
                });
                const files = (s3Response.Contents || [])
                    .filter((file) => !file.Key.endsWith("/"))
                    .map((file) => {
                        const parts = file.Key.split("/").filter((p) => p);
                        const fileName = parts.pop() || "";
                        const name = fileName.replace(/\.[^.]+$/, "");
                        const author = parts[parts.length - 1];
                        const imgCdn = process.env.VUE_APP_IMG_CDN || "";
                        const ghOwner = process.env.VUE_APP_GH_OWNER || "";
                        const ghRepo = process.env.VUE_APP_GH_REPO || "";
                        const thumbnailUrl = `${imgCdn}/${ghOwner}/${ghRepo}/${encodeURIComponent(author)}/${encodeURIComponent(name)}.jpg`;
                        const s3Endpoint = process.env.VUE_APP_S3_ENDPOINT || "";
                        const s3Domain = process.env.VUE_APP_S3_DOMAIN || "";
                        const s3CustomDomain = process.env.VUE_APP_S3_CUSTOM_DOMAIN || s3Domain;
                        const videoUrl = s3Endpoint.replace(s3Domain, s3CustomDomain) + "/" + encodeURIComponent(file.Key);
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
                            duration: null,
                        };
                    });
                const authors = [...new Set(files.map((file) => file.author))].filter((author) => author);
                const metadata = {};
                for (let i = 0; i < authors.length; i += 3) {
                    const batch = authors.slice(i, i + 3);
                    await Promise.all(
                        batch.map(async (author) => {
                            try {
                                const safeAuthor = encodeURIComponent(author.trim());
                                const baseUrl = process.env.NODE_ENV === "development" ? "" : window.location.origin;
                                const apiUrl = `${baseUrl}/api/xovideos?author=${safeAuthor}`;
                                const response = await fetch(apiUrl, {
                                    method: "GET",
                                    headers: {
                                        Accept: "application/json",
                                        "Cache-Control": "no-cache",
                                    },
                                });
                                if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                }
                                const data = await response.json();
                                if (data.status === "success") {
                                    data.data.forEach((item) => {
                                        const key = `${item.author}/${item.video_title}`;
                                        metadata[key] = {
                                            views: item.video_views,
                                            duration: item.duration,
                                        };
                                    });
                                }
                            } catch (error) {
                                console.error(`获取元数据失败: ${author}`, error);
                            }
                        })
                    );
                    if (i + 3 < authors.length) {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }
                }
                files.forEach((file) => {
                    const key = `${file.author}/${file.name}`;
                    if (metadata[key]) {
                        file.views = metadata[key].views;
                        file.duration = metadata[key].duration;
                    }
                });
                this.directoryCache[this.currentPath] = [...dirs, ...files];
                this.files = this.directoryCache[this.currentPath];
            } catch (error) {
                console.error("加载文件列表失败:", error);
                this.error = `加载失败: ${error.message}`;
            } finally {
                this.loading = false;
            }
        },

        async loadInitialData() {
            try {
                // 首先加载根目录和视频元数据
                await Promise.all([this.loadFileList(), this.loadAllVideoMetadata()]);
                
                // 预加载所有作者目录，以便在首页搜索时能够找到作者目录
                if (this.directoryCache[""] && this.directoryCache[""].length > 0) {
                    const authorDirs = this.directoryCache[""].filter(f => f.IsDirectory);
                    
                    // 确保将作者目录添加到搜索结果中
                    authorDirs.forEach(dir => {
                        // 确保目录对象有正确的属性
                        if (!dir.path) dir.path = "";
                        if (!dir.type) dir.type = "directory";
                    });
                    
                    console.log(`预加载 ${authorDirs.length} 个作者目录...`);
                    
                    // 限制并发请求数量，每次处理5个目录
                    for (let i = 0; i < authorDirs.length; i += 5) {
                        const batch = authorDirs.slice(i, i + 5);
                        await Promise.all(
                            batch.map(dir => {
                                const dirPath = dir.Key;
                                if (!this.directoryCache[dirPath]) {
                                    // 临时保存当前路径
                                    const currentPathBackup = this.currentPath;
                                    // 设置当前路径为作者目录
                                    this.currentPath = dirPath;
                                    // 加载作者目录内容
                                    return this.loadFileList().then(() => {
                                        // 恢复当前路径
                                        this.currentPath = currentPathBackup;
                                    });
                                }
                                return Promise.resolve();
                            })
                        );
                        // 添加小延迟，避免请求过于频繁
                        if (i + 5 < authorDirs.length) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                    
                    console.log(`作者目录预加载完成，共 ${Object.keys(this.directoryCache).length} 个目录`);
                }
                
                // 从视频元数据中提取作者信息，确保即使S3中没有对应目录也能搜索到作者
                if (this.videoMetadataByAuthor) {
                    for (const author in this.videoMetadataByAuthor) {
                        // 检查是否已经有这个作者的目录
                        const authorDirPath = author + "/";
                        if (!this.directoryCache[authorDirPath] && author.trim() !== "") {
                            // 创建一个虚拟的作者目录
                            this.directoryCache[authorDirPath] = [
                                {
                                    Key: authorDirPath,
                                    IsDirectory: true,
                                    name: author,
                                    path: "",
                                    type: "directory",
                                    author: author
                                }
                            ];
                        }
                    }
                }
            } catch (error) {
                console.error("加载初始数据失败:", error);
                this.error = `加载失败: ${error.message}`;
            }
        },

        async loadAllVideoMetadata() {
            try {
                const apiUrl = "/api/xovideos";
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`API请求失败: ${response.status}`);
                }
                const data = await response.json();
                if (data.status === "success" && Array.isArray(data.data)) {
                    this.videoMetadata = data.data;
                    this.videoMetadataByAuthor = {};
                    for (const video of data.data) {
                        const author = video.author || "未知作者";
                        if (!this.videoMetadataByAuthor[author]) {
                            this.videoMetadataByAuthor[author] = [];
                        }
                        this.videoMetadataByAuthor[author].push(video);
                    }
                }
            } catch (error) {
                console.error("加载视频元数据失败:", error);
            }
        },

        updateBrowserUrl() {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("path", this.currentPath);
            window.history.replaceState({}, "", newUrl.toString());
        },

        handleFileClick(file) {
            if (file.IsDirectory) {
                const newPath = file.Key.replace(/\/?$/, "/");
                this.updateHistory(newPath);
                this.currentPath = newPath;
            } else {
                this.currentVideo = {
                    url: file.videoUrl,
                    title: file.name,
                    key: file.Key,
                };
                this.videoPlayerVisible = true;
            }
        },

        closeVideoPlayer() {
            this.videoPlayerVisible = false;
            this.currentVideo = null;
            // 保持搜索结果状态，如果之前是在搜索状态
            this.isSearchActive = this.searchResults.length > 0;
        },

        formatDate(timestamp) {
            try {
                const date = new Date(timestamp);
                return date.toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                }).replace(/\//g, "-");
            } catch (e) {
                return "N/A";
            }
        },

        formatSize(bytes) {
            if (typeof bytes !== "number") return "0 B";
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
            if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
            return `${(bytes / 1073741824).toFixed(1)} GB`;
        },

        handleMouseButtons(event) {
            if (event.button === 3) {
                this.navigateBack();
            } else if (event.button === 4) {
                this.navigateForward();
            }
        },

        navigateToRoot() {
            this.updateHistory("");
            this.currentPath = "";
            this.clearSearch(); // 添加清除搜索的逻辑
        },

        navigateTo(index) {
            const newPath = this.pathParts.slice(0, index + 1).join("/") + "/";
            this.updateHistory(newPath);
            this.currentPath = newPath;
            this.clearSearch(); // 添加清除搜索的逻辑
        },
    },
};