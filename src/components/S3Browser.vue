<template>
  <div class="s3-browser">
    <header class="header">
      <h1 class="main-title">
        <span class="title-icon"></span>
        <span class="emoji">🌈</span>
        <span class="gradient-text">微光小溪·S4</span>
      </h1>
      <p class="sub-title animated-subtitle">🎥 一款基于Vue丨Fastapi的S3管理器</p>
    </header>

    <!-- 搜索框 -->
    <div class="search-container">
      <div class="search-input-wrapper">
        <input type="text" v-model="searchQuery" @input="handleSearchInput" placeholder="搜索文件或视频..."
          class="search-input" />
        <button class="search-button" @click="performSearch">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
        <button v-if="searchQuery" class="clear-button" @click="clearSearch">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
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
            d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22">
          </path>
        </svg>
      </a>
      <button @click="toggleDarkMode" class="action-button theme-toggle" title="切换主题">
        <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
    </div>

    <!-- 面包屑导航 -->
    <nav class="breadcrumb">
      <span class="breadcrumb-item" @click="navigateToRoot">S4://viper3</span>
      <span v-if="pathParts.length > 0" class="separator">/</span>
      <span v-for="(part, index) in pathParts" :key="index" @click="navigateTo(index)" class="breadcrumb-item">
        {{ part }}
        <span v-if="index < pathParts.length - 1" class="separator">/</span>
      </span>
    </nav>

    <!-- 搜索结果区域 -->
    <div v-if="isSearchActive" class="search-results">
      <div class="search-results-header">
        <h2>搜索结果: {{ searchResults.length }} 个匹配项</h2>
        <button class="close-search" @click="clearSearch">关闭</button>
      </div>
      <!-- 作者目录部分 -->
      <div v-if="authorDirectories.length > 0" class="author-directories">
        <h3 class="section-title">作者目录</h3>
        <div class="directory-grid">
          <div v-for="dir in authorDirectories" :key="dir.Key" class="folder-card"
            @click="handleSearchResultClick(dir)">
            <div class="folder-icon">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor"
                  d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
            </div>
            <div class="file-info">
              <h3 class="file-name">{{ dir.name }}</h3>
            </div>
          </div>
        </div>
      </div>
      <!-- 视频文件部分 -->
      <div v-if="videoFiles.length > 0" class="video-files">
        <h3 class="section-title">视频文件</h3>
        <div class="video-grid">
          <div v-for="file in videoFiles" :key="file.Key || file.id" class="video-card"
            @click="handleSearchResultClick(file)">
            <div class="thumbnail-container">
              <img v-if="file.thumbnail_url || file.thumbnailUrl" :src="file.thumbnail_url || file.thumbnailUrl"
                class="thumbnail-image" :alt="file.video_title || file.name" loading="lazy" />
              <div v-else class="thumbnail placeholder">
                <svg viewBox="0 0 24 24" width="36" height="36">
                  <path fill="currentColor" d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div class="video-overlay">
                <div class="play-indicator">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="currentColor" d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div class="video-meta-overlay">
                  <span class="duration" v-if="file.duration">
                    <svg class="meta-icon" viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor"
                        d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                    </svg>
                    {{ file.duration }}
                  </span>
                  <span class="views" v-if="file.video_views || file.views">
                    <svg class="meta-icon" viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor"
                        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                    {{ file.video_views || file.views }}
                  </span>
                </div>
              </div>
            </div>
            <div class="file-info">
              <h3 class="file-name">{{ file.video_title || file.name }}</h3>
              <div class="file-details">
                <span class="file-size">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  {{ formatSize(file.Size) }}
                </span>
                <span class="file-date">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  {{ formatDate(file.LastModified || file.upload_date) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-container" v-show="!isSearchActive">
      <div v-if="loading" class="loading-overlay">
        <div class="loader"></div>
      </div>
      <div v-if="error" class="error-alert">
        {{ error }}
      </div>
      <div v-else>
        <!-- 文件网格 -->
        <div class="video-grid">
          <!-- 目录项 -->
          <div v-for="file in files.filter((f) => f.IsDirectory)" :key="file.Key" class="folder-card"
            @click="handleFileClick(file)">
            <div class="folder-icon">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor"
                  d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
            </div>
            <div class="file-info">
              <h3 class="file-name">{{ file.name }}</h3>
            </div>
          </div>
          <!-- 文件项 -->
          <div v-for="file in files.filter((f) => !f.IsDirectory)" :key="file.Key" class="video-card"
            @click="handleFileClick(file)">
            <div class="thumbnail-container">
              <img v-lazy="file.thumbnailUrl || generatePlaceholder(file.Key)" class="thumbnail-image"
                :alt="file.name" />
              <div class="video-overlay">
                <div class="play-indicator">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="currentColor" d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div class="video-meta-overlay">
                  <span class="duration" v-if="file.duration !== undefined">
                    <svg class="meta-icon" viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor"
                        d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                    </svg>
                    {{ file.duration }}
                  </span>
                  <span class="views" v-if="file.views !== undefined">
                    <svg class="meta-icon" viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor"
                        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                    {{ file.views }}
                  </span>
                </div>
              </div>
            </div>
            <div class="file-info">
              <h3 class="file-name">{{ file.name }}</h3>
              <div class="file-details">
                <span class="file-size">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  {{ formatSize(file.Size) }}
                </span>
                <span class="file-date">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  {{ formatDate(file.LastModified) }}
                </span>
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
          <button @click="closeVideoPlayer" class="close-button">×</button>
        </div>
        <div class="video-player-container">
          <video v-if="currentVideo" controls autoplay class="video-player" :src="currentVideo.url">
            您的浏览器不支持 HTML5 视频播放。
          </video>
        </div>
      </div>
    </div>

    <!-- 页脚 -->
    <footer class="footer">
      <p class="copyright">微光小溪·S4丨小暮笙©2025</p>
    </footer>
  </div>
</template>