<template>
  <div class="ban-pool-container">
    <div class="ban-header-bar">
      <div class="stripe-pattern"></div>
      
      <div class="header-content">
        <span class="icon">⚠</span>
        <span class="label">禁用协议 // BANNED PROTOCOL</span>
        <span class="count" v-if="totalBanned > 0">[{{ totalBanned }} OPERATORS DETECTED]</span>
        <span class="count" v-else>[SYSTEM NORMAL]</span>
      </div>
    </div>
    <div class="ban-content">
      <div class="ban-grid">
        <div 
          v-for="(groupData, subClass) in bannedMap" 
          :key="subClass"
          class="ban-group"
        >
          <div class="group-label">
            {{ groupData.professionCn ? `${groupData.professionCn}-${subClass}` : subClass }}
          </div>
          
          <div class="group-avatars">
            <div 
              v-for="op in groupData.operators" 
              :key="op.name" 
              class="banned-avatar"
              :title="op.name"
            >
              <img :src="op.avatar" class="banned-img" @error="handleImageError">
              <div class="ban-overlay">
                <span class="cross">✕</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="totalBanned === 0" class="empty-msg">
        <div>NO BANNED DATA</div>
        <div class="sub-empty">暂无干员被熔断</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  // 接收数据结构: { "尖兵": { professionCn: "先锋", operators: [{name, avatar}, ...] }, "领主": { professionCn: "近卫", operators: [...] } }
  bannedMap: {
    type: Object,
    default: () => ({})
  }
});

// 移除 isExpanded，改为常驻显示

const totalBanned = computed(() => {
  if (!props.bannedMap) return 0;
  let count = 0;
  Object.values(props.bannedMap).forEach(groupData => {
    if (groupData && groupData.operators) {
      count += groupData.operators.length;
    }
  });
  return count;
});

const handleImageError = (e) => {
  e.target.style.display = 'none'; // 图片挂了就隐藏，只显示红框
}
</script>

<style scoped>
.ban-pool-container {
  position: absolute;
  bottom: 20px; /* 与观众栏和历史记录栏底部对齐 */
  left: 50%;
  transform: translateX(-50%) rotateX(90deg); /* 以底边为轴，向内90度反转 */
  transform-origin: bottom center; /* 以底边为轴 */
  transform-style: preserve-3d;
  width: 90%;
  max-width: 1400px;
  z-index: 99; /* 低于按钮（按钮是100），但高于大部分内容 */
  font-family: 'Rajdhani', 'Noto Sans SC', sans-serif;
  box-shadow: 0 4px 20px rgba(0,0,0,0.8);
  opacity: 0.25; /* 默认35%不透明度 */
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.ban-pool-container:hover {
  opacity: 0.8; /* 悬停时90%不透明度 */
  transform: translateX(-50%) rotateX(15deg); /* 悬停时不再反转 */
}

/* =========================================
   1. 标题栏 (Header Bar) - 常驻显示
   ========================================= */
.ban-header-bar {
  height: 40px;
  background: rgba(17, 17, 17, 0.95);
  border: 2px solid #D50000;
  border-bottom: none;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  user-select: none;
}

/* 核心：动态斜杠条纹 */
.stripe-pattern {
  position: absolute; 
  top: 0; left: 0; 
  width: 200%; /* 宽一点以便动画滚动 */
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 8px,
    rgba(255, 255, 255, 0.1) 8px,
    rgba(255, 255, 255, 0.1) 16px
  );
  pointer-events: none;
  animation: stripe-scroll 57.14s linear infinite; /* 减速至35%：20s / 0.35 = 57.14s */
  opacity: 0.6; /* 默认状态下稍微降低透明度 */
}

/* 展开时增强条纹效果 */
.ban-pool-container.is-expanded .stripe-pattern {
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(213, 0, 0, 0.15) 10px,
    rgba(213, 0, 0, 0.15) 20px
  );
  opacity: 1;
}

@keyframes stripe-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.header-content {
  color: #D50000;
  font-weight: 900;
  font-size: 14px;
  letter-spacing: 2px;
  display: flex; 
  gap: 10px; 
  align-items: center;
  z-index: 2;
  text-shadow: 0 0 5px rgba(213, 0, 0, 0.5);
  opacity: 1; /* 常驻显示 */
}

.icon { font-size: 16px; }

/* =========================================
   2. 内容区 (Content) - 常驻显示
   ========================================= */
.ban-content {
  height: 120px; /* 高度扩展至1.5倍（原80px * 1.5 = 120px） */
  background: rgba(10, 10, 10, 0.95);
  backdrop-filter: blur(10px);
  padding: 10px 20px;
  overflow-x: hidden;
  overflow-y: auto; /* 支持纵向滚动 */
  border: 2px solid #D50000;
  border-top: none;
}

/* 纵向滚动条美化 */
.ban-content::-webkit-scrollbar { 
  width: 6px; 
}
.ban-content::-webkit-scrollbar-thumb { 
  background: #D50000; 
  border-radius: 3px; 
}
.ban-content::-webkit-scrollbar-track { 
  background: rgba(0, 0, 0, 0.5); 
}

.ban-grid {
  display: flex;
  flex-wrap: wrap; /* 允许换行 */
  gap: 15px;
  align-items: flex-start;
  justify-content: center;
  min-height: 100%;
}

/* 分支组 - 支持换行布局 */
.ban-group {
  background: rgba(255, 0, 0, 0.05);
  border: 1px solid #444;
  padding: 8px 12px;
  border-radius: 4px;
  display: flex;
  flex-direction: column; /* 纵向布局：标签在上，头像在下 */
  align-items: center;
  gap: 6px;
  border-left: 2px solid #D50000;
  min-width: 120px;
  max-width: 500px; /* 增加最大宽度，容纳更多头像 */
  width: fit-content; /* 根据内容自适应宽度 */
}

.group-label {
  font-size: 11px; 
  color: #aaa; 
  font-weight: bold;
  letter-spacing: 1px;
  text-align: center;
  width: 100%;
  margin-bottom: 4px;
}

.group-avatars {
  display: flex; 
  flex-wrap: wrap; /* 允许头像换行 */
  gap: 4px; 
  align-items: center;
  justify-content: center;
}

/* 被禁用的头像 - 缩小尺寸 */
.banned-avatar {
  width: 40px; 
  height: 40px; 
  position: relative;
  background: #000;
  border: 1px solid #555;
  transition: all 0.2s;
  flex-shrink: 0;
}

.banned-avatar:hover {
  border-color: #D50000;
  transform: scale(1.1);
  z-index: 10;
}

.banned-img { 
  width: 100%; height: 100%; 
  object-fit: cover; 
  filter: grayscale(100%) contrast(1.2); /* 黑白高对比 */
  opacity: 0.6;
}

.ban-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(50, 0, 0, 0.4);
}

.cross {
  color: #D50000; 
  font-size: 24px; 
  font-weight: bold;
  text-shadow: 0 0 5px #000;
}

/* 空状态 */
.empty-msg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #444; 
  font-family: 'Rajdhani';
  width: 100%;
}

.empty-msg div:first-child { font-size: 24px; font-weight: bold; letter-spacing: 4px; }
.sub-empty { font-size: 12px; margin-top: 5px; opacity: 0.5; }
</style>

