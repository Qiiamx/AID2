<template>
  <div class="tech-background">
    <div class="giant-number fade-in-delayed">02</div>
    
    <div class="rotating-logo-container fade-in-delayed">
      <svg class="rh-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" stroke="currentColor" stroke-width="1" stroke-dasharray="10 5" opacity="0.3"/>
        <circle cx="50" cy="50" r="40" stroke="currentColor" stroke-width="2" opacity="0.5"/>
        <path d="M50 20 L80 70 H20 L50 20Z" stroke="currentColor" stroke-width="2" fill="none" opacity="0.6"/>
        <rect x="45" y="40" width="10" height="40" fill="currentColor" opacity="0.4"/>
      </svg>
    </div>
    
    <div class="scanline fade-in-delayed"></div>
    
    <div class="deco-coords top-right fade-in-delayed">
      <span>SYS.MONITOR</span>
      <span class="coord-val">X: {{ coords.x }}</span>
      <span class="coord-val">Y: {{ coords.y }}</span>
    </div>
    
    <div class="deco-coords bottom-right fade-in-delayed">
      <span>NET.LATENCY: {{ latency }}ms</span>
      <span class="blink">/// CONNECTED</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// 接收父组件传入的主题色（已移除光雾，保留 props 以兼容，但不再使用）
const props = defineProps({
  theme: {
    type: String,
    default: 'blue'
  }
})

// 模拟坐标跳动逻辑
const coords = ref({ x: '000.00', y: '000.00' })
const latency = ref(24)

let intervalId = null

onMounted(() => {
  intervalId = setInterval(() => {
    // 随机生成看起来很像坐标的数字
    coords.value.x = (Math.random() * 1000).toFixed(2)
    coords.value.y = (Math.random() * 1000).toFixed(2)
    latency.value = Math.floor(Math.random() * 10) + 20
  }, 300) // 300ms 跳动一次
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
/* =========================================
   全局容器
   ========================================= */
.tech-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000000; /* 纯黑 */
  z-index: 0; /* 确保它在最底层，但比 html body 高 */
  overflow: hidden;
  pointer-events: none; /* 关键：点击穿透，不影响前景交互 */
  font-family: 'Rajdhani', monospace; /* 建议使用的机能字体 */
}

/* =========================================
   1. 巨大的背景数字 02
   ========================================= */
.giant-number {
  position: absolute;
  right: -50px;
  bottom: -100px;
  font-size: 60vh; /* 占据屏幕高度的60% */
  font-weight: 900;
  line-height: 1;
  color: transparent;
  /* 描边效果：形成镂空感 */
  -webkit-text-stroke: 2px rgba(255, 255, 255, 0.03);
  text-stroke: 2px rgba(255, 255, 255, 0.03);
  z-index: 1;
  user-select: none;
  font-family: 'Rajdhani', 'Arial', sans-serif;
}

/* =========================================
   2. 旋转 Logo
   ========================================= */
.rotating-logo-container {
  position: absolute;
  bottom: -10%;
  left: -10%;
  width: 60vh;
  height: 60vh;
  opacity: 0.05; /* 几乎透明 */
  z-index: 2;
  color: #fff;
  /* 同时应用淡入和旋转动画 */
  animation: fadeInDelayed 1.5s ease-in-out forwards 1s,
             rotate 60s linear infinite;
}

.rh-logo {
  width: 100%;
  height: 100%;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* =========================================
   3. 扫描线
   ========================================= */
.scanline {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, rgba(0, 229, 255, 0.5) 50%, transparent 100%);
  opacity: 0;
  z-index: 3;
  /* 同时应用淡入和扫描动画 */
  animation: fadeInDelayed 1.5s ease-in-out forwards 1s,
             scan 5s linear infinite;
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
}

@keyframes scan {
  0% { top: -10%; }
  100% { top: 110%; }
}

/* =========================================
   4. 装饰性坐标
   ========================================= */
.deco-coords {
  position: absolute;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  font-family: monospace;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.top-right {
  top: 100px; /* 避开顶部栏 */
  right: 20px;
  text-align: right;
}

.bottom-right {
  bottom: 20px;
  right: 20px;
  text-align: right;
}

.coord-val {
  font-weight: bold;
  color: rgba(255, 255, 255, 0.5);
}

.blink {
  animation: blink 1s steps(2, start) infinite;
  color: #00AEEF;
}

@keyframes blink {
  to { opacity: 0; }
}

/* =========================================
   5. 淡入动画（延迟1秒）
   ========================================= */
.fade-in-delayed {
  opacity: 0;
  animation: fadeInDelayed 1.5s ease-in-out forwards;
  animation-delay: 1s; /* 延迟1秒后开始淡入 */
}

/* 对于旋转 Logo，需要特殊处理：淡入后保持原始透明度 */
.rotating-logo-container.fade-in-delayed {
  animation: fadeInDelayedLogo 1.5s ease-in-out forwards 1s,
             rotate 60s linear infinite;
}

@keyframes fadeInDelayed {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes fadeInDelayedLogo {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 0.05; /* 淡入后保持原始透明度 */
  }
}
</style>

