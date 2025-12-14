<template>
  <div class="battle-top-hud">
    
    <div class="hud-module stage-monitor">
      <div class="module-content">
        <div class="sub-label">系统状态 // CURRENT PHASE</div>
        
        <div class="main-info">
          <span class="stage-icon">💠</span>
          <span class="stage-text">{{ currentStageText }}</span>
        </div>

        <div class="deco-bar"></div>
      </div>
    </div>

    <div class="hud-module host-panel">
      <div class="module-content">
        <div class="host-info-col">
          <div class="host-role">管理员 // HOST</div>
          <div class="host-name">{{ hostInfo.nickname || 'UNKNOWN' }}</div>
        </div>

        <div class="host-avatar-box">
          <img :src="hostInfo.avatar || '/default_avatar.png'" alt="HOST" class="avatar-img">
          <div class="corner-mark top-left"></div>
          <div class="corner-mark bottom-right"></div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // 接收外部传入的阶段状态
  // e.g. 'OPENING', 'GAME_ROUND', 'TERMINATED'
  stage: {
    type: String,
    default: 'OPENING'
  },
  // 具体的轮数 (如果有)
  roundNumber: {
    type: Number,
    default: 1
  },
  // 主持人信息对象
  hostInfo: {
    type: Object,
    default: () => ({ nickname: 'Dr. Kaltsit', avatar: '' })
  }
});

// 计算显示的文本
const currentStageText = computed(() => {
  switch (props.stage) {
    case 'OPENING': return 'OPENING // 开局部署';
    case 'GAME_ROUND': return `ROUND ${String(props.roundNumber).padStart(2, '0')} // 博弈对抗`;
    case 'TERMINATED': return 'TERMINATED // 比赛终止';
    default: return 'STANDBY // 准备中';
  }
});
</script>

<style scoped>
/* =========================================
   容器布局
   ========================================= */
.battle-top-hud {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 80px; /* 顶部栏高度 */
  z-index: 1000; /* 保证在最上层 */
  display: flex;
  justify-content: space-between; /* 左右贴边 */
  align-items: flex-start;
  padding: 20px 40px; /* 内边距 */
  box-sizing: border-box;
  pointer-events: none; /* 让中间空白区域可以点击穿透到下层的3D场景 */
}

/* =========================================
   通用模块样式 (HUD Module)
   ========================================= */
.hud-module {
  pointer-events: auto; /* 模块本身可交互 */
  background: rgba(20, 20, 20, 0.85); /* 深色半透明背景 */
  backdrop-filter: blur(10px); /* 毛玻璃 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 20px;
  
  /* 初始 3D 状态 */
  transform: perspective(800px) rotateX(0deg) translateZ(0);
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  
  /* 机能风切角 */
  clip-path: polygon(
    0 0, 
    100% 0, 
    100% calc(100% - 10px), 
    calc(100% - 15px) 100%, 
    0 100%
  );
  
  cursor: default;
}

/* =========================================
   交互特效：悬浮发光 + 倾斜
   ========================================= */
.hud-module:hover {
  /* 向前突进 + 微微抬头 */
  transform: perspective(800px) rotateX(5deg) translateZ(20px);
  
  /* 描边高亮 (罗德岛青) */
  border-color: #00AEEF;
  
  /* 发光辉光 */
  box-shadow: 0 10px 30px rgba(0, 174, 239, 0.3);
  
  /* 背景变亮一点 */
  background: rgba(30, 30, 30, 0.95);
}

/* =========================================
   1. 左侧：阶段监视器样式
   ========================================= */
.stage-monitor {
  min-width: 260px;
  border-left: 4px solid #fff; /* 左侧白色粗条 */
}

.stage-monitor:hover {
  border-left-color: #00AEEF; /* 悬浮变色 */
}

.sub-label {
  font-family: 'Rajdhani', monospace;
  font-size: 12px;
  color: #888;
  letter-spacing: 1px;
  margin-bottom: 2px;
}

.main-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Noto Sans SC', sans-serif;
  font-weight: 900;
  font-size: 20px;
  color: #fff;
  text-transform: uppercase;
}

.stage-icon {
  font-size: 16px;
  color: #00AEEF;
  animation: pulse 2s infinite;
}

.deco-bar {
  margin-top: 5px;
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, #00AEEF 0%, transparent 100%);
  opacity: 0.5;
}

/* =========================================
   2. 右侧：主持人面板样式
   ========================================= */
.host-panel .module-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.host-info-col {
  text-align: right; /* 文字右对齐 */
}

.host-role {
  font-family: 'Rajdhani', monospace;
  font-size: 10px;
  color: #FFD700; /* 主持人金色 */
  letter-spacing: 2px;
  font-weight: bold;
}

.host-name {
  font-family: 'Noto Sans SC', sans-serif;
  font-weight: 700;
  font-size: 16px;
  color: #eee;
}

/* 头像容器 (缩小版) */
.host-avatar-box {
  position: relative;
  width: 40px;  /* 相比大厅明显缩小 */
  height: 40px;
  background: #333;
  border: 1px solid #555;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 角落装饰 */
.corner-mark {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #fff;
  transition: background 0.3s;
}
.top-left { top: -1px; left: -1px; }
.bottom-right { bottom: -1px; right: -1px; }

/* 悬浮时装饰变色 */
.host-panel:hover .corner-mark {
  background: #00AEEF;
}

/* =========================================
   动画定义
   ========================================= */
@keyframes pulse {
  0%, 100% { opacity: 1; text-shadow: 0 0 5px #00AEEF; }
  50% { opacity: 0.5; text-shadow: none; }
}
</style>
