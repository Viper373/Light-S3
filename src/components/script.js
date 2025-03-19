import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

function initializeS3Client(component) {
  const region = process.env.VUE_APP_S3_REGION;
  const endpoint = process.env.VUE_APP_S3_ENDPOINT;
  const accessKeyId = process.env.VUE_APP_S3_ACCESS_KEY;
  const secretAccessKey = process.env.VUE_APP_S3_SECRET_KEY;
  component.s3Client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

function generateUrl(key) {
  const s3Endpoint = process.env.VUE_APP_S3_ENDPOINT || "";
  const s3Domain = process.env.VUE_APP_S3_DOMAIN || "";
  const s3CustomDomain = process.env.VUE_APP_S3_CUSTOM_DOMAIN || s3Domain;
  return `${s3Endpoint.replace(s3Domain, s3CustomDomain)}/${encodeURIComponent(key)}`;
}

async function loadDirectoryInfo(component, dirKey) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.VUE_APP_S3_BUCKET,
      Prefix: dirKey,
      Delimiter: '/',
    });
    const response = await component.s3Client.send(command);
    const files = response.Contents || [];
    const fileCount = files.filter(file => !file.Key.endsWith('/')).length;
    let latestUpdate = 'N/A';
    if (files.length > 0) {
      const dates = files
        .filter(f => f.LastModified)
        .map(f => new Date(f.LastModified));
      if (dates.length > 0) {
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        latestUpdate = component.formatDate(maxDate);
      }
    }
    return { fileCount, latestUpdate };
  } catch (error) {
    console.error(`Failed to load info for directory ${dirKey}:`, error);
    return { fileCount: 0, latestUpdate: 'N/A' };
  }
}

function handleSearchInput(component) {
  if (component.searchQuery.length >= 1) {
    if (component.searchTimeout) clearTimeout(component.searchTimeout);
    component.searchTimeout = setTimeout(() => component.performSearch(), 300);
  } else {
    component.clearSearch();
  }
}

async function performSearch(component) {
  if (!component.searchQuery || !component.searchQuery.trim()) {
    component.clearSearch();
    return;
  }
  const query = component.searchQuery.trim().toLowerCase();
  try {
    const s3Results = await component.searchS3Files(query);
    const metadataResults = component.searchVideoMetadata(query);
    component.searchResults = [...s3Results, ...metadataResults];
    component.isSearchActive = component.searchResults.length > 0;
  } catch (error) {
    console.error("搜索失败:", error);
  }
}

async function searchS3Files(component, query) {
  let results = [];
  for (const [path, files] of Object.entries(component.directoryCache)) {
    const matchedFiles = files.filter(file => {
      const fileName = file.Key.split('/').pop().toLowerCase();
      const fullPath = file.Key.toLowerCase();
      return fileName.includes(query) || fullPath.includes(query);
    });
    const formattedResults = matchedFiles.map(file => {
      const result = {
        ...file,
        path: path || '/',
        type: file.IsDirectory ? 'directory' : component.getFileType(file.Key.split('/').pop()),
      };
      if (file.IsDirectory) {
        result.fileCount = null;
        result.latestUpdate = null;
        component.loadDirectoryInfo(file.Key).then(({ fileCount, latestUpdate }) => {
          result.fileCount = fileCount;
          result.latestUpdate = latestUpdate;
          component.$forceUpdate();
        });
      }
      return result;
    });
    results = [...results, ...formattedResults];
  }
  return results.slice(0, 50);
}

function searchVideoMetadata(component, query) {
  if (!query) return [];
  return component.videoMetadata
    .filter(video => {
      const title = (video.video_title || "").toLowerCase();
      const author = (video.author || "").toLowerCase();
      return title.includes(query) || author.includes(query);
    })
    .map(video => ({
      ...video,
      type: "video",
      name: video.video_title,
      thumbnail_url: `${process.env.VUE_APP_IMG_CDN}/${process.env.VUE_APP_GH_OWNER}/${process.env.VUE_APP_GH_REPO}/${encodeURIComponent(video.author || "")}/${encodeURIComponent(video.video_title || "")}.jpg`,
      Size: video.Size || 104857600,
      LastModified: video.upload_date || new Date().toISOString(),
      views: video.video_views || 0,
      duration: video.duration || "N/A",
      IsDirectory: false,
    }));
}

function clearSearch(component) {
  component.searchQuery = "";
  component.searchResults = [];
  component.isSearchActive = false;
}

function applyDarkModePreference(_component) {
  const savedDarkMode = localStorage.getItem("darkMode");
  const isDark = savedDarkMode === "true" || (!savedDarkMode && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark-mode", isDark);
}

function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
}

function initPathFromUrl(component) {
  const urlParams = new URLSearchParams(window.location.search);
  const initialPath = urlParams.get("path") || "";
  component.browsingHistory = [initialPath];
  component.historyIndex = 0;
  component.currentPath = initialPath;
}

function updateHistory(component, newPath) {
  if (newPath === component.browsingHistory[component.historyIndex]) return;
  component.browsingHistory = [...component.browsingHistory.slice(0, component.historyIndex + 1), newPath];
  component.historyIndex = component.browsingHistory.length - 1;
}

function navigateBack(component) {
  if (component.historyIndex > 0) {
    component.historyIndex--;
    component.currentPath = component.browsingHistory[component.historyIndex];
  }
}

function navigateForward(component) {
  if (component.historyIndex < component.browsingHistory.length - 1) {
    component.historyIndex++;
    component.currentPath = component.browsingHistory[component.historyIndex];
  }
}

async function loadFileList(component) {
  if (component.directoryCache[component.currentPath]) {
    component.files = component.directoryCache[component.currentPath];
    return;
  }
  component.loading = true;
  component.error = null;
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.VUE_APP_S3_BUCKET,
      Prefix: component.currentPath,
      Delimiter: "/",
    });
    const s3Response = await component.s3Client.send(command);
    const dirs = (s3Response.CommonPrefixes || []).map(prefix => {
      const parts = prefix.Prefix.split("/").filter(p => p);
      const dirObj = {
        Key: prefix.Prefix,
        IsDirectory: true,
        name: parts[parts.length - 1] || "",
        author: parts.length > 1 ? parts[parts.length - 2] : "",
        fileCount: null,
        latestUpdate: null,
      };
      component.loadDirectoryInfo(prefix.Prefix).then(({ fileCount, latestUpdate }) => {
        dirObj.fileCount = fileCount;
        dirObj.latestUpdate = latestUpdate;
        component.$forceUpdate();
      }).catch(err => {
        console.error(`加载目录 ${prefix.Prefix} 信息失败:`, err);
      });
      return dirObj;
    });
    const files = (s3Response.Contents || [])
      .filter(file => !file.Key.endsWith("/"))
      .map(file => {
        const parts = file.Key.split("/").filter(p => p);
        const fileName = parts.pop() || "";
        const name = fileName.replace(/\.[^.]+$/, "");
        const author = parts[parts.length - 1];
        const thumbnailUrl = `${process.env.VUE_APP_IMG_CDN}/${process.env.VUE_APP_GH_OWNER}/${process.env.VUE_APP_GH_REPO}/${encodeURIComponent(author)}/${encodeURIComponent(name)}.jpg`;
        const videoUrl = generateUrl(file.Key);
        return {
          Key: file.Key,
          IsDirectory: false,
          name,
          author,
          Size: file.Size,
          LastModified: file.LastModified?.toISOString(),
          thumbnailUrl,
          videoUrl,
        };
      });
    component.directoryCache[component.currentPath] = [...dirs, ...files];
    component.files = component.directoryCache[component.currentPath];
  } catch (error) {
    console.error("加载文件列表失败:", error);
    component.error = `加载失败: ${error.message}`;
  } finally {
    component.loading = false;
  }
}

async function loadInitialData(component) {
  try {
    await Promise.all([component.loadFileList(), component.loadAllVideoMetadata()]);
  } catch (error) {
    console.error("加载初始数据失败:", error);
    component.error = `加载失败: ${error.message}`;
  }
}

async function loadAllVideoMetadata(component) {
  try {
    const response = await fetch("/api/xovideos");
    if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
    const data = await response.json();
    if (data.status === "success" && Array.isArray(data.data)) {
      component.videoMetadata = data.data;
      component.videoMetadataByAuthor = {};
      for (const video of data.data) {
        const author = video.author || "未知作者";
        if (!component.videoMetadataByAuthor[author]) component.videoMetadataByAuthor[author] = [];
        component.videoMetadataByAuthor[author].push(video);
      }
    }
  } catch (error) {
    console.error("加载视频元数据失败:", error);
  }
}

function updateBrowserUrl(component) {
  const newUrl = new URL(window.location.href);
  if (component.currentPath) newUrl.searchParams.set("path", component.currentPath);
  else newUrl.searchParams.delete("path");
  window.history.replaceState({}, "", newUrl.toString());
}

function handleFileClick(component, file) {
  if (file.IsDirectory) {
    const newPath = file.Key.replace(/\/?$/, "/");
    component.updateHistory(newPath);
    component.currentPath = newPath;
    component.clearSearch(); // 清除搜索
  } else {
    component.currentVideo = { url: file.videoUrl, title: file.name, key: file.Key };
    component.videoPlayerVisible = true;
  }
}

function closeVideoPlayer(component) {
  component.videoPlayerVisible = false;
  component.currentVideo = null;
}

function formatDate(component, timestamp) {
  try {
    const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(d.getTime())) return "N/A";
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ` +
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  } catch (error) {
    console.error("日期格式化错误:", error);
    return "N/A";
  }
}

function formatSize(component, bytes) {
  if (typeof bytes !== "number") return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function handleMouseButtons(component, event) {
  if (event.button === 3) component.navigateBack();
  else if (event.button === 4) component.navigateForward();
}

function navigateToRoot(component) {
  component.updateHistory("");
  component.currentPath = "";
  component.clearSearch();
}

function navigateTo(component, index) {
  const newPath = component.pathParts.slice(0, index + 1).join("/") + "/";
  component.updateHistory(newPath);
  component.currentPath = newPath;
  component.clearSearch();
}

function getFileType(component, fileName) {
  const extension = fileName.split(".").pop().toLowerCase();
  const videoExtensions = ["mp4", "webm", "ogg", "mov", "avi", "mkv"];
  return videoExtensions.includes(extension) ? "video" : "file";
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
      directoryCache: {},
      videoPlayerVisible: false,
      currentVideo: null,
      searchQuery: "",
      searchResults: [],
      searchTimeout: null,
      isSearchActive: false,
      videoMetadata: [],
      videoMetadataByAuthor: {},
      uniqueVisitors: 0,
      totalVisits: 0,
    };
  },
  computed: {
    pathParts() {
      return this.currentPath.split("/").filter(p => p);
    },
  },
  watch: {
    currentPath() {
      this.loadFileList();
      this.updateBrowserUrl();
    },
  },
  async created() {
    this.initializeS3Client();
    window.addEventListener("mouseup", e => this.handleMouseButtons(e));
    this.initPathFromUrl();
    await this.loadInitialData();
    await this.fetchStats();
  },
  mounted() {
    this.applyDarkModePreference();
  },
  beforeUnmount() {
    window.removeEventListener("mouseup", e => this.handleMouseButtons(e));
  },
  methods: {
    initializeS3Client() { return initializeS3Client(this); },
    generateUrl(key) { return generateUrl(key); },
    loadDirectoryInfo(dirKey) { return loadDirectoryInfo(this, dirKey); },
    handleSearchInput() { return handleSearchInput(this); },
    performSearch() { return performSearch(this); },
    searchS3Files(query) { return searchS3Files(this, query); },
    searchVideoMetadata(query) { return searchVideoMetadata(this, query); },
    clearSearch() { return clearSearch(this); },
    applyDarkModePreference() { return applyDarkModePreference(this); },
    toggleDarkMode() { return toggleDarkMode(); },
    initPathFromUrl() { return initPathFromUrl(this); },
    updateHistory(newPath) { return updateHistory(this, newPath); },
    navigateBack() { return navigateBack(this); },
    navigateForward() { return navigateForward(this); },
    loadFileList() { return loadFileList(this); },
    loadInitialData() { return loadInitialData(this); },
    loadAllVideoMetadata() { return loadAllVideoMetadata(this); },
    updateBrowserUrl() { return updateBrowserUrl(this); },
    handleFileClick(file) { return handleFileClick(this, file); },
    closeVideoPlayer() { return closeVideoPlayer(this); },
    formatDate(timestamp) { return formatDate(this, timestamp); },
    formatSize(bytes) { return formatSize(this, bytes); },
    handleMouseButtons(event) { return handleMouseButtons(this, event); },
    navigateToRoot() { return navigateToRoot(this); },
    navigateTo(index) { return navigateTo(this, index); },
    getFileType(fileName) { return getFileType(this, fileName); },
    async fetchStats() {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        if (data.status === 'success') {
          this.uniqueVisitors = data.data.unique_visitors;
          this.totalVisits = data.data.total_visits;
        }
      } catch (error) {
        console.error('获取统计数据失败:', error);
      }
    },
  },
};