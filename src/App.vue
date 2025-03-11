<template>
  <div class="container">
    <h1>缤纷云Bitiful S4文件管理器</h1>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <S3Browser v-else />
  </div>
</template>

<script>
import S3Browser from './components/S3Browser.vue'

export default {
  components: {
    S3Browser
  },
  data() {
    return {
      loading: true,
      error: null
    }
  },
  async mounted() {
    try {
      await new Promise(resolve => setTimeout(resolve, 500)) // 模拟加载延迟
      this.loading = false
    } catch (e) {
      this.error = '初始化失败: ' + e.message
      this.loading = false
    }
  }
}
</script>

<style>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
}

.loading {
  text-align: center;
  color: #666;
  font-size: 18px;
  padding: 20px;
}

.error {
  color: #dc3545;
  background: #ffe6e6;
  padding: 15px;
  border-radius: 4px;
  margin: 20px 0;
}

/* 添加全局卡片悬停效果 */
.thumbnail-card {
  transition: transform 0.2s;
  cursor: pointer;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.thumbnail-card:hover {
  transform: translateY(-5px);
}

.video-info {
  padding: 12px;
}

.video-info h3 {
  margin: 0;
  font-size: 14px;
  color: #333;
}
</style>