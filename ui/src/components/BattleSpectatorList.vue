<template>
  <div 
    class="spectator-container" 
    :class="{ 'is-expanded': isExpanded }"
  >
    <div class="spec-header" @click="isExpanded = !isExpanded">
      <div class="header-content">
        <img src="/images/观众.png" class="icon" alt="观众">
        <span class="label">观众 // SPECTATORS</span>
        <span class="count">[{{ spectators.length }}]</span>
      </div>
      <div class="arrow" :class="{ 'up': isExpanded }">▲</div>
    </div>
    <div class="spec-list">
      <div v-if="spectators.length === 0" class="empty-spec">
        NO SPECTATORS // 暂无观众
      </div>
      
      <div 
        v-for="(user, index) in spectators" 
        :key="index" 
        class="spec-item"
      >
        <div class="avatar-box">
          <img :src="user.avatar || '/default_avatar.png'" class="avatar-img" @error="handleImageError">
        </div>
        <div class="spec-name">{{ user.nickname || 'Unknown Doctor' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  spectators: {
    type: Array,
    default: () => [] // [{ nickname: 'Doc', avatar: '' }, ...]
  }
});

const isExpanded = ref(false); // 默认折叠

const handleImageError = (e) => {
  e.target.style.display = 'none';
};
</script>

<style scoped>
.spectator-container {
  position: absolute;
  bottom: 20px;
  left: 20px; /* 左下角 */
  width: 220px;
  background: rgba(10, 10, 10, 0.9);
  border: 1px solid #333;
  border-left: 4px solid #32FF64; /* 绿色系 */
  z-index: 100;
  transition: height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 默认只显示头部 */
  height: 40px; 
}

/* 展开高度 */
.spectator-container.is-expanded {
  height: 300px;
}

/* 头部样式 */
.spec-header {
  height: 40px;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  cursor: pointer;
  flex-shrink: 0;
}

.spec-header:hover {
  background: #222;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: bold;
  color: #32FF64;
  font-family: 'Rajdhani', sans-serif;
}

.header-content .icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.arrow {
  font-size: 10px;
  color: #666;
  transition: transform 0.3s;
}

.arrow.up { transform: rotate(180deg); }

/* 列表样式 */
.spec-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  
  /* 滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #32FF64 #111;
}

.spec-list::-webkit-scrollbar { width: 4px; }

.spec-list::-webkit-scrollbar-thumb { background: #32FF64; border-radius: 2px; }

.spec-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-bottom: 1px dashed #333;
}

.avatar-box {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background: #333;
}

.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.spec-name {
  color: #ccc;
  font-size: 12px;
  font-family: 'Noto Sans SC', sans-serif;
}

.empty-spec {
  text-align: center;
  color: #555;
  margin-top: 50px;
  font-size: 10px;
}
</style>

