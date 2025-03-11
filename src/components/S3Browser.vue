<template>
  <div class="s3-browser">
    <!-- 导航控制 -->
    <div class="navigation-controls">
      <button @click="navigateBack" :disabled="historyIndex <= 0" class="nav-button" title="后退">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <button @click="navigateForward" :disabled="historyIndex >= browsingHistory.length - 1" class="nav-button"
        title="前进">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
    
    <!-- 面包屑导航 -->
    <nav class="breadcrumb">
      <!-- 添加根目录导航 -->
      <span class="breadcrumb-item" @click="navigateToRoot">
        S4://viper3
      </span>
      <span v-if="pathParts.length > 0" class="separator">/</span>

      <span v-for="(part, index) in pathParts" :key="index" @click="navigateTo(index)" class="breadcrumb-item">
        {{ part }}
        <span v-if="index < pathParts.length - 1" class="separator">/</span>
      </span>
    </nav>

    <!-- 内容区域 -->
    <div class="content-container">
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
          <div v-for="file in files.filter(f => f.IsDirectory)" :key="file.Key" class="directory-card"
               @click="handleFileClick(file)">
            <div class="directory-icon">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor"
                      d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
            </div>
            <div class="file-info">
              <h3 class="file-name">{{ getFolderName(file.Key) }}</h3>
            </div>
          </div>
          
          <!-- 文件项 -->
          <div v-for="file in files.filter(f => !f.IsDirectory)" :key="file.Key" class="video-card"
            @click="handleFileClick(file)">
            <div class="thumbnail-container">
              <img v-lazy="{
                src: file.thumbnailUrl || generatePlaceholder(file.Key),
                loading: 'lazy',
                error: fallbackHandler
              }" class="thumbnail-image" :alt="cleanFileName(file.Key)" :srcset="responsiveSrcSet(file)"
                sizes="(max-width: 480px) 90vw, (max-width: 1024px) 45vw, 30vw" width="1600" height="900"
                style="aspect-ratio: 16/9">
              <div class="video-overlay">
                <div class="play-indicator">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="currentColor" d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <div class="video-meta-overlay">
                  <span class="duration" v-if="file.duration !== undefined">
                    <svg class="meta-icon" viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor"
                        d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                    </svg>
                    {{ formatDuration(file.duration) }}
                  </span>
                  <span class="views" v-if="file.views !== undefined">
                    <svg class="meta-icon" viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor"
                        d="M12 5c4.063 0 7.526 2.62 8.972 6.205.4.97.4 2.091 0 3.09C19.526 18.38 16.063 21 12 21s-7.526-2.62-8.972-6.205a4.93 4.93 0 0 1 0-3.09C4.474 7.62 7.937 5 12 5zm0 2c-3.013 0-5.612 1.82-6.919 4.5a5.03 5.03 0 0 0 0 2.999C6.388 15.18 8.987 17 12 17s5.612-1.82 6.919-4.5a5.03 5.03 0 0 0 0-2.999C17.612 8.82 15.013 7 12 7zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
                    </svg>
                    {{ formatViews(file.views) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="file-info">
              <h3 class="file-name">{{ cleanFileName(file.Key) }}</h3>
              <div class="file-details">
                <span class="file-size">💾 {{ formatSize(file.Size) }}</span>
                <span class="file-date">📅 {{ formatDate(file.LastModified) }}</span>
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
  </div>
</template>
<script>
import componentScript from './script.js'
import './style.css'

export default componentScript
</script>
