<template>
  <div class="phase-indicator">
    <div class="phase-label">系统状态 // CURRENT PHASE</div>
    <div class="phase-value" :key="phaseText">
      <span class="icon">💠</span>
      <span class="text">{{ phaseText }}</span>
    </div>
    <div class="deco-bar"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  phase: {
    type: String,
    required: true // 'OPENING', 'WAITING', 'BIDDING', etc.
  },
  round: {
    type: Number,
    default: 1
  }
});

const phaseText = computed(() => {
  switch (props.phase) {
    case 'OPENING': return 'OPENING // 开局部署';
    case 'OPENING_SHOW': return 'DEPLOYING // 干员抽取';
    case 'WAITING': return 'STANDBY // 等待指令';
    case 'BIDDING_ANIMATION': return 'INITIALIZING // 链路连接';
    case 'BIDDING': return `ROUND ${String(props.round).padStart(2, '0')} // 博弈对抗`;
    case 'BIDDING_ENDED_WAITING': return 'STANDBY // 等待指令';
    case 'STRATEGY_TRANSITION': return 'TRANSITION // 阶段转换';
    case 'STRATEGY_PREP': return 'STRATEGY PREP // 攻略准备';
    case 'STRATEGY_COMPLETED': return 'COMPLETED // 攻略完成';
    case 'TERMINATED': return 'TERMINATED // 比赛终止';
    default: return 'UNKNOWN // 未知状态';
  }
});
</script>

<style scoped>
.phase-indicator {
  position: absolute;
  top: 20px;
  left: 20px;
  padding: 10px 20px;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 4px solid #fff; /* 左侧粗边框 */
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%); /* 切角 */
  min-width: 260px;
  transition: all 0.3s ease;
  z-index: 100; /* 保证在最上层 */
}

/* 悬停发光 */
.phase-indicator:hover {
  border-left-color: #00AEEF;
  box-shadow: 0 0 20px rgba(0, 174, 239, 0.2);
}

.phase-label {
  font-family: 'Rajdhani', sans-serif;
  font-size: 10px;
  color: #888;
  letter-spacing: 1px;
  margin-bottom: 2px;
}

.phase-value {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Noto Sans SC', sans-serif;
  font-weight: 900;
  font-size: 20px;
  color: #fff;
  text-transform: uppercase;
  /* 文本切换动画 */
  animation: slideIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.icon {
  color: #00AEEF;
  font-size: 16px;
  animation: pulse 2s infinite;
}

.deco-bar {
  margin-top: 5px;
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, #00AEEF 0%, transparent 100%);
  opacity: 0.5;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; text-shadow: 0 0 5px #00AEEF; }
  50% { opacity: 0.5; text-shadow: none; }
}
</style>


