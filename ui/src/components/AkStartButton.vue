<template>
  <button class="ak-start-btn-container" @click="$emit('click')" :disabled="disabled">
    
    <div class="diamond-frame">
      
      <div class="content-straight">
        <div class="play-icon">▶</div>
        <div class="start-text">START</div>
      </div>
      
    </div>
    
    <div class="glow-backdrop"></div>
  </button>
</template>

<script setup>
defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
});

defineEmits(['click']);
</script>

<style scoped>
/* =========================================
   1. 按钮容器
   ========================================= */
.ak-start-btn-container {
  /* 清除默认按钮样式 */
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  outline: none;

  /* 定义大小，必须是正方形才能转出完美的菱形 */
  width: 84px; /* 120px * 0.7 */
  height: 84px; /* 120px * 0.7 */
  position: relative;
  
  /* 居中放置，腾出空间给旋转后的角 */
  margin: 20px auto; 
  display: flex;
  align-items: center;
  justify-content: center;
}

.ak-start-btn-container:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  filter: grayscale(1);
}

/* =========================================
   2. 菱形边框层 (核心视觉)
   ========================================= */
.diamond-frame {
  position: absolute;
  width: 100%;
  height: 100%;
  
  /* 核心：旋转 45 度 */
  transform: rotate(45deg);
  
  /* 方舟风格：黄色轮廓边框 */
  border: 3px solid #FFD700; /* 金黄色 */
  
  /* 初始状态的微弱内发光 */
  box-shadow: inset 0 0 15px rgba(255, 215, 0, 0.2);
  
  /* 丝滑过渡 */
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  /* 确保内容在中心 */
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* 稍微加一点背景色，不是完全透明 */
  background: rgba(255, 215, 0, 0.05);
  
  z-index: 2;
}

/* =========================================
   3. 内容摆正层
   ========================================= */
.content-straight {
  /* 核心：反向旋转 45 度，把内容摆正 */
  transform: rotate(-45deg);
  
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #FFD700; /* 文字颜色与边框一致 */
  
  /* 微调位置，视觉居中 */
  margin-top: 3.5px; /* 5px * 0.7 */ 
}

.play-icon {
  font-size: 16.8px; /* 24px * 0.7 */
  line-height: 1;
  margin-bottom: 3.5px; /* 5px * 0.7 */
  /* 给图标加一点文字阴影，增加发光感 */
  text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
}

.start-text {
  font-family: 'Noto Sans SC', sans-serif; /* 或者方舟常用的英文/数字字体 */
  font-weight: 900;
  font-size: 12.6px; /* 18px * 0.7 */
  letter-spacing: 0.7px; /* 1px * 0.7 */
  text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
}

/* =========================================
   4. 交互特效 (Hover & Active)
   ========================================= */

/* 鼠标悬停：强烈发光 + 呼吸感 */
.ak-start-btn-container:hover:not(:disabled) .diamond-frame {
  background: rgba(255, 215, 0, 0.15); /* 背景变亮 */
  border-color: #FFF700; /* 边框变更亮 */
  
  /* 核心：多重阴影制造强烈的 Outline 发光效果 */
  box-shadow: 
    0 0 15px rgba(255, 215, 0, 0.6),   /* 外发光 */
    0 0 30px rgba(255, 215, 0, 0.4),   /* 更远的外发光 */
    inset 0 0 20px rgba(255, 215, 0, 0.4); /* 内发光增强 */
    
  /* 稍微放大一点，增加呼吸感 */
  transform: rotate(45deg) scale(1.05);
}

/* 点击瞬间：收缩反馈 */
.ak-start-btn-container:active:not(:disabled) .diamond-frame {
  transform: rotate(45deg) scale(0.95);
  box-shadow: 
    0 0 5px rgba(255, 215, 0, 0.8),
    inset 0 0 10px rgba(255, 215, 0, 0.6);
  transition: all 0.1s;
}

/* =========================================
   (可选) 背景装饰光晕
   ========================================= */
.glow-backdrop {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 140%;
  height: 140%;
  transform: translate(-50%, -50%) rotate(45deg);
  background: radial-gradient(circle, rgba(255, 215, 0, 0.2) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.5s;
  z-index: 1;
  pointer-events: none;
}

.ak-start-btn-container:hover:not(:disabled) .glow-backdrop {
  opacity: 1;
  animation: pulse-glow 2s infinite alternate;
}

@keyframes pulse-glow {
  from { transform: translate(-50%, -50%) rotate(45deg) scale(1); opacity: 0.8; }
  to { transform: translate(-50%, -50%) rotate(45deg) scale(1.2); opacity: 0.4; }
}
</style>
