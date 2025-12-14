<template>
  <div 
    class="action-log-panel" 
    :class="{ 'is-expanded': isExpanded }"
  >
    <div class="log-header" @click="isExpanded = !isExpanded">
      <div class="header-content">
        <img src="/images/记录.png" class="icon" alt="记录">
        <span class="title">战术记录 // BATTLE LOG</span>
      </div>
      <div class="arrow" :class="{ 'up': isExpanded }">▲</div>
    </div>
    
    <div class="log-body" ref="logBodyRef">
      <div v-if="logs.length === 0" class="empty-log">NO DATA RECORDED</div>
      
      <div v-for="(log, index) in logs" :key="index" class="log-entry" :class="log.type">
        <div v-if="log.type === 'round'" class="round-header">
          —— {{ log.text }} ——
        </div>
        
        <div v-else class="log-content">
          <span class="time">[{{ log.time }}]</span>
          <span class="text" v-html="formatLogText(log)"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  logs: {
    type: Array,
    default: () => [] // [{ type: 'team-a', text: '...', time: '12:00' }, ...]
  },
  // 当前用户角色和队伍，用于做一些高亮处理（可选）
  userRole: {
    type: String,
    default: 'SPECTATOR'
  },
  userTeam: {
    type: String,
    default: ''
  }
});

const logBodyRef = ref(null);
const isExpanded = ref(false); // 默认折叠，点击展开

// 深度监听日志数组变化，确保响应式更新
watch(() => props.logs, () => {
  nextTick(() => {
    if (logBodyRef.value) {
      logBodyRef.value.scrollTop = logBodyRef.value.scrollHeight;
    }
  });
}, { deep: true });

const formatLogText = (log) => {
  // 如果用户不是选手，直接返回原始文本
  if (props.userRole !== 'PLAYER') return log.text;

  // 判断日志是否属于对手
  const isOpponent = (props.userTeam === 'A' && log.type === 'team-b') || 
                     (props.userTeam === 'B' && log.type === 'team-a');

  if (isOpponent) {
     // 【信息隔断】隐藏对手的具体数值
     // 正则替换数值：例如 "队伍B选择消耗5点调用点..." -> "队伍B选择消耗?点调用点..."
     // 匹配模式：数字+点（如 "5点"、"10点"）或 "回复数字"（如 "回复5"）
     return log.text
       .replace(/\d+点/g, '?点')  // 替换 "5点"、"10点" 等
       .replace(/回复\d+/g, '回复?')  // 替换 "回复5"、"回复10" 等
       .replace(/剩余\d+点/g, '剩余?点')  // 替换 "剩余5点"、"剩余10点" 等
       .replace(/使用\d+点/g, '使用?点')  // 替换 "使用5点"、"使用10点" 等
       .replace(/扣除\d+点/g, '扣除?点')  // 替换 "扣除5点"、"扣除10点" 等
       .replace(/恢复\d+点/g, '恢复?点');  // 替换 "恢复5点"、"恢复10点" 等
  }
  
  // 自己的日志，直接返回
  return log.text;
};
</script>

<style scoped>
.action-log-panel {
  position: absolute;
  bottom: 20px;
  right: 20px; /* 右下角 */
  width: 350px;
  background: rgba(10, 10, 10, 0.7);
  border: 1px solid #333;
  display: flex;
  flex-direction: column;
  z-index: 100;
  font-family: 'Noto Sans SC', sans-serif;
  transition: height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  overflow: hidden;
  /* 默认只显示头部，与观众栏同一水平线 */
  height: 40px;
  /* 切角造型 */
  clip-path: polygon(0 0, 100% 0, 100% 100%, 20px 100%, 0 calc(100% - 20px));
}

/* 展开高度 */
.action-log-panel.is-expanded {
  height: 250px;
}

.log-header {
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

.log-header:hover {
  background: #222;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-content .icon { 
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.header-content .title { 
  font-size: 12px; 
  font-weight: bold; 
  color: #888; 
  letter-spacing: 1px; 
}

.arrow {
  font-size: 10px;
  color: #666;
  transition: transform 0.3s;
}

.arrow.up { 
  transform: rotate(180deg); 
}

.log-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #ccc;
  
  /* 滚动条美化 */
  scrollbar-width: thin;
  scrollbar-color: #444 #1a1a1a;
}

.log-body::-webkit-scrollbar { width: 6px; }

.log-body::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }

.log-body::-webkit-scrollbar-track { background: #1a1a1a; }

.empty-log {
  text-align: center;
  color: #555;
  margin-top: 80px;
  font-family: 'Rajdhani';
}

.log-entry { margin-bottom: 6px; }

/* 不同类型的日志样式 */
.round-header {
  text-align: center;
  color: #FFD700;
  font-weight: bold;
  margin: 15px 0 5px 0;
  border-top: 1px dashed #333;
  padding-top: 10px;
}

/* 队伍配色 */
/* 这里的类名对应 logs 数据中的 type */
:deep(.team-a) { color: #99ccff; } /* A队偏蓝 */
:deep(.team-b) { color: #ff9999; } /* B队偏红 */
:deep(.highlight) { color: #FFD700; font-weight: bold; } /* 重点信息 */
:deep(.system) { color: #aaa; font-style: italic; } /* 系统信息 */

.time {
  color: #555;
  margin-right: 5px;
  font-family: 'Consolas', monospace;
  font-size: 10px;
}
</style>

