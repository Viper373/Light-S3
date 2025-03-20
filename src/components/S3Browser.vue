<template>
  <div class="s3-browser">
    <header class="header">
      <h1 class="main-title">
        <span class="title-icon" />
        <span class="emoji">🌈</span>
        <span class="gradient-text">微光小溪·S4</span>
      </h1>
      <p class="sub-title animated-subtitle">
        🎥 一款基于Vue丨Fastapi的S3管理器
      </p>
    </header>

    <!-- 搜索框 -->
    <div class="search-container">
      <div class="search-input-wrapper">
        <input v-model="searchQuery" type="text" placeholder="搜索文件或视频..." class="search-input"
          @input="handleSearchInput">
        <button class="search-button" @click="performSearch">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <button v-if="searchQuery" class="clear-button" @click="clearSearch">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 顶部操作栏 -->
    <div class="top-actions">
      <a href="https://github.com/Viper373/S3Browser" target="_blank" class="action-button" title="GitHub">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path
            d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      </a>
      <button class="action-button theme-toggle" title="切换主题" @click="toggleDarkMode">
        <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>
    </div>

    <!-- 面包屑导航 -->
    <nav class="breadcrumb">
      <span class="breadcrumb-item" @click="navigateToRoot">首页</span>
      <span v-if="pathParts.length > 0" class="separator">/</span>
      <span v-for="(part, index) in pathParts" :key="index" class="breadcrumb-item" @click="navigateTo(index)">
        {{ part }}
        <span v-if="index < pathParts.length - 1" class="separator">/</span>
      </span>
    </nav>

    <!-- 搜索结果区域 -->
    <div v-if="isSearchActive" class="search-results">
      <div class="search-results-header">
        <h2>搜索结果: {{ searchResults.length }} 个匹配项</h2>
        <button class="close-search" @click="clearSearch">
          关闭
        </button>
      </div>
      <div class="content-container">
        <!-- 作者目录部分 -->
        <div v-if="searchDirectories.length > 0" class="search-section">
          <h3 class="section-title">作者目录 ({{ searchDirectories.length }})</h3>
          <div class="video-grid">
            <div v-for="file in searchDirectories" :key="file.Key" class="folder-card" @click="handleFileClick(file)">
              <div class="folder-icon">
                <svg viewBox="0 0 24 24" width="48" height="48">
                  <path fill="currentColor"
                    d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
              </div>
              <div class="file-info">
                <h3 class="file-name">
                  {{ file.name }}
                </h3>
                <div class="folder-meta">
                  <div class="file-count">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span v-if="file.fileCount !== null">视频数量 {{ file.fileCount }}</span>
                    <span v-else>加载中...</span>
                  </div>
                  <div class="latest-update">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span v-if="file.latestUpdate !== null">{{ file.latestUpdate }}</span>
                    <span v-else>加载中...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 视频文件部分 -->
        <div v-if="searchFiles.length > 0" class="search-section">
          <h3 class="section-title">视频文件 ({{ searchFiles.length }})</h3>
          <div class="video-grid">
            <div v-for="file in searchFiles" :key="file.Key" class="video-card" @click="handleFileClick(file)">
              <div class="thumbnail-container">
                <img :src="file.thumbnailUrl" class="thumbnail-image" :alt="file.name" loading="lazy">
                <div class="video-overlay">
                  <div class="play-indicator">
                    <svg viewBox="0 0 24 24" width="48" height="48">
                      <path fill="currentColor" d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <!-- 左上角显示作者 -->
                  <div class="video-author">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>{{ file.author || '未知作者' }}</span>
                  </div>
                  <!-- 左下角显示视频时长 -->
                  <div class="video-duration">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>{{ file.duration || 'N/A' }}</span>
                  </div>
                  <!-- 右下角显示观看次数 -->
                  <div class="video-views">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span>{{ file.views || 0 }}</span>
                  </div>
                </div>
              </div>
              <div class="file-info">
                <h3 class="file-name">
                  {{ file.name }}
                </h3>
                <div class="file-details">
                  <span class="file-size">{{ formatSize(file.Size) }}</span>
                  <span class="file-date">{{ formatDate(file.LastModified) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div v-show="!isSearchActive" class="content-container">
      <div v-if="loading" class="loading-overlay">
        <div class="loader" />
      </div>
      <div v-if="error" class="error-alert">
        {{ error }}
      </div>
      <div v-else>
        <div class="video-grid">
          <div v-for="file in files" :key="file.Key" :class="file.IsDirectory ? 'folder-card' : 'video-card'"
            @click="handleFileClick(file)">
            <div v-if="file.IsDirectory" class="folder-icon">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor"
                  d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
            </div>
            <div v-else class="thumbnail-container">
              <img :src="file.thumbnailUrl" class="thumbnail-image" :alt="file.name" loading="lazy">
              <div class="video-overlay">
                <div class="play-indicator">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="currentColor" d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <!-- 左上角显示作者 -->
                <div class="video-author">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span>{{ file.author || '未知作者' }}</span>
                </div>
                <!-- 左下角显示视频时长 -->
                <div class="video-duration">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>{{ file.duration || 'N/A' }}</span>
                </div>
                <!-- 右下角显示观看次数 -->
                <div class="video-views">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span>{{ file.views || 0 }}</span>
                </div>
              </div>
            </div>
            <div class="file-info">
              <h3 class="file-name">
                {{ file.name }}
              </h3>
              <div v-if="file.IsDirectory" class="folder-meta">
                <div class="file-count">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <span v-if="file.fileCount !== null">视频数量 {{ file.fileCount }}</span>
                  <span v-else>加载中...</span>
                </div>
                <div class="latest-update">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span v-if="file.latestUpdate !== null">{{ file.latestUpdate }}</span>
                  <span v-else>加载中...</span>
                </div>
              </div>
              <div v-else class="file-details">
                <span class="file-size">{{ formatSize(file.Size) }}</span>
                <span class="file-date">{{ formatDate(file.LastModified) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 视频播放器模态框 -->
    <div v-if="videoPlayerVisible" class="video-modal">
      <div class="video-modal-content">
        <div class="video-modal-header">
          <h3>{{ currentVideo?.title }}</h3>
          <button class="close-button" @click="closeVideoPlayer">
            ×
          </button>
        </div>
        <div class="video-player-container">
          <video v-if="currentVideo" controls autoplay class="video-player" :src="currentVideo.url">
            您的浏览器不支持 HTML5 视频播放。
          </video>
        </div>
      </div>
    </div>

    <footer class="footer">
      <div class="stats-container">
        <div class="stat-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>访客人数: {{ uniqueVisitors }}</span>
        </div>
        <div class="stat-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>访问量: {{ totalVisits }}</span>
        </div>
      </div>
      <p class="copyright">©微光小溪S4丨小暮笙@2025</p>
    </footer>
  </div>
</template>

<script>
import componentScript from './script.js';
import './style.css';

export default componentScript;
</script>