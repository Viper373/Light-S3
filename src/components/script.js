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
    },

    beforeUnmount() {
        window.removeEventListener("mouseup", this.handleMouseButtons);
        this.scrollObserver?.disconnect();
    },

    methods: {
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
                const s3Results = await this.searchS3Files(query);
                const metadataResults = await this.searchVideoMetadata(query);
                const allResults = [...s3Results, ...metadataResults];
                this.authorDirectories = allResults.filter(result => result.IsDirectory && result.Key);
                this.videoFiles = allResults.filter(result => !result.IsDirectory);
                this.searchResults = allResults;
                this.isSearchActive = this.searchResults.length > 0;
                console.log("搜索结果:", allResults);
                console.log("作者目录:", this.authorDirectories);
                console.log("视频文件:", this.videoFiles);
            } catch (error) {
                console.error("搜索失败:", error);
            }
        },

        async searchS3Files(query) {
            if (Object.keys(this.directoryCache).length === 0) {
                await this.loadFileList();
            }
            let results = [];
            for (const [path, files] of Object.entries(this.directoryCache)) {
                const matchedFiles = files.filter((file) => {
                    const fileName = file.Key.split("/").pop().toLowerCase();
                    const fullPath = file.Key.toLowerCase();
                    const authorName = file.author ? file.author.toLowerCase() : "";
                    return (
                        fileName.includes(query) ||
                        fullPath.includes(query) ||
                        authorName.includes(query)
                    );
                });
                const formattedResults = matchedFiles.map((file) => ({
                    ...file,
                    path: path || "/",
                    type: file.IsDirectory ? "directory" : this.getFileType(file.Key.split("/").pop()),
                }));
                results = [...results, ...formattedResults];
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
                this.currentPath = result.path + (result.path.endsWith("/") ? "" : "/") + result.name;
                this.clearSearch();
            } else if (result.type === "video") {
                this.searchAndPlayVideo(result);
            } else {
                this.handleFileClick(result);
                this.clearSearch();
            }
        },

        async searchAndPlayVideo(videoMetadata) {
            try {
                const videoTitle = videoMetadata.video_title || "";
                const author = videoMetadata.author || "";
                let videoFile = null;
                if (author && this.directoryCache[author]) {
                    videoFile = this.findBestMatchingVideo(this.directoryCache[author], videoTitle);
                }
                if (!videoFile) {
                    for (const [_path, files] of Object.entries(this.directoryCache)) {
                        const found = this.findBestMatchingVideo(files, videoTitle);
                        if (found) {
                            videoFile = found;
                            break;
                        }
                    }
                }
                if (videoFile && !videoFile.videoUrl) {
                    const s3Endpoint = process.env.VUE_APP_S3_ENDPOINT || "";
                    const s3Domain = process.env.VUE_APP_S3_DOMAIN || "";
                    const s3CustomDomain = process.env.VUE_APP_S3_CUSTOM_DOMAIN || s3Domain;
                    videoFile.videoUrl = s3Endpoint.replace(s3Domain, s3CustomDomain) + "/" + encodeURIComponent(videoFile.Key);
                }
                if (videoFile) {
                    this.handleFileClick(videoFile);
                    this.clearSearch();
                } else {
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
                await Promise.all([this.loadFileList(), this.loadAllVideoMetadata()]);
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
        },

        navigateTo(index) {
            const newPath = this.pathParts.slice(0, index + 1).join("/") + "/";
            this.updateHistory(newPath);
            this.currentPath = newPath;
        },
    },
};