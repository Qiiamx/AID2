<template>
  <div 
    class="mask-container"
    :class="{ 'active': isActive }" 
  >
    <div 
      class="mask-body"
      :style="maskStyle"
    >
      <div class="mask-edge"></div>

      <div class="mask-content">
        
        <div class="loading-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>

        <div class="loading-text">
          <div class="main-title">页面加载中，请稍后...</div>
          <div class="sub-title">不如用这个时间构思一下战术？或者想一下要支持哪位选手？</div>
        </div>

        <div class="loading-bar-container">
          <div class="loading-bar" :class="{ 'filling': stage === 'holding' }"></div>
        </div>

      </div>

      <div class="mask-texture"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const isActive = ref(false)
const stage = ref('hidden') // 'hidden' | 'entering' | 'holding' | 'leaving'
const enableTransition = ref(true) // 【新增】控制过渡动画开关
let currentTimer = null // 【新增】全局定时器引用
let isTransitioning = false // 【新增】正在转场标志，防止重复调用

// 核心位置控制
const maskStyle = computed(() => {
  let transform = ''
  switch (stage.value) {
    case 'hidden': transform = 'skewX(-20deg) translateX(120%)'; break;
    case 'entering': transform = 'skewX(-20deg) translateX(0%)'; break;
    case 'holding': transform = 'skewX(-20deg) translateX(0%)'; break;
    case 'leaving': transform = 'skewX(-20deg) translateX(-120%)'; break;
  }
  
  return { 
    transform,
    // 【关键修复】动态控制 transition。只有为 true 时才启用动画。
    transition: enableTransition.value ? 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)' : 'none' 
  }
})

const start = (onCoveredCallback) => {
  // 【防重复调用】如果正在转场，忽略新的调用
  // 返回 false 表示转场被忽略，调用者可以使用备用方案
  if (isTransitioning) {
    console.log('[TransitionMask] 转场进行中，忽略重复调用')
    return false
  }
  
  // 【关键修复】清理旧的定时器，防止多重调用冲突
  if (currentTimer) {
    clearInterval(currentTimer)
    currentTimer = null
  }
  
  // 标记为正在转场
  isTransitioning = true
  
  console.log('[TransitionMask] 启动转场')
  
  // 1. 【瞬间复位】先禁用动画，并将位置重置到起点(hidden)
  // 这样遮罩会"瞬移"回右边，用户看不见
  enableTransition.value = false
  stage.value = 'hidden'
  isActive.value = true
  
  // 2. 【延迟启动】下一帧（50ms后）启用动画并开始进场
  // 这是为了让浏览器有时间渲染"瞬移"后的状态
  setTimeout(() => {
    enableTransition.value = true
    
    // 强制开始进场
    stage.value = 'entering'
    
    // 记录起始时间
    const startTime = Date.now()
    
    // 定义关键时间点 (单位 ms)
    const T_ENTER_END = 800
    const T_HOLD_END = 2800
    const T_LEAVE_END = 3600
    
    let callbackExecuted = false
    
    currentTimer = setInterval(() => {
      const now = Date.now()
      const elapsed = now - startTime
      
      // 阶段 1: 进场 (0 - 800ms) - CSS处理，这里只做状态保底
      
      // 阶段 2: 覆盖回调 (800ms)
      if (elapsed >= T_ENTER_END && !callbackExecuted) {
        // 确保状态正确
        if (stage.value !== 'holding') stage.value = 'holding'
        
        console.log(`[TransitionMask] 触发回调 (elapsed: ${elapsed}ms)`)
        try {
          if (onCoveredCallback) onCoveredCallback()
        } catch (e) {
          console.error('[TransitionMask] 回调执行出错:', e)
          // 即使出错也要继续走流程，否则遮罩会一直盖着
        }
        callbackExecuted = true
      }
      
      // 阶段 3: 离场 (2800ms)
      if (elapsed >= T_HOLD_END) {
        if (stage.value !== 'leaving') {
          console.log('[TransitionMask] 遮罩离场')
          stage.value = 'leaving'
        }
      }
      
      // 阶段 4: 结束 (3600ms)
      if (elapsed >= T_LEAVE_END) {
        clearInterval(currentTimer)
        currentTimer = null
        
        // 动画结束后，默默复位并隐藏
        setTimeout(() => {
          isActive.value = false
          enableTransition.value = false // 禁用动画
          stage.value = 'hidden'       // 瞬间复位
          isTransitioning = false     // 重置转场标志
        }, 100)
      }
    }, 100)
  }, 50)
  
  // 返回 true 表示转场已启动
  return true
}

defineExpose({ start })
</script>

<style scoped>
/* 容器：最高层级 */
.mask-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10000; /* 比之前的 wipe 更高 */
  pointer-events: none;
  overflow: hidden;
}

.mask-container.active {
  pointer-events: auto;
}

/* 遮罩主体 */
.mask-body {
  position: absolute;
  top: 0;
  left: -25vw; /* 抵消倾斜 */
  width: 150vw;
  height: 100%;
  
  /* 工业灰背景 */
  background-color: #2B2B2B;
  
  /* 阴影 */
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.8);
  
  /* 动画过渡由 JavaScript 动态控制，不在此处设置 */
  will-change: transform;
  
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 边缘装饰线 */
.mask-edge {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 10px;
  background: #3F3F3F;
  border-right: 2px solid #555;
}

/* 背景纹理 (斜线) */
.mask-texture {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.02) 0px,
    rgba(255, 255, 255, 0.02) 2px,
    transparent 2px,
    transparent 10px
  );
  pointer-events: none;
  z-index: 0;
}

/* 内容容器 (反向纠正倾斜) */
.mask-content {
  transform: skewX(20deg); /* 把字变正 */
  text-align: center;
  z-index: 10;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* --- 动态跳跃点 --- */
.loading-dots {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.dot {
  width: 12px;
  height: 12px;
  background-color: #FFCD00; /* 罗德岛黄 */
  border-radius: 2px; /* 方形圆角，更硬朗 */
  animation: jump 1.2s infinite ease-in-out;
}

.dot:nth-child(1) {
  animation-delay: 0s;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes jump {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-15px);
    opacity: 1;
    background-color: #fff; /* 跳起变白 */
  }
}

/* 文字样式 */
.loading-text {
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  letter-spacing: 1px;
}

.main-title {
  font-size: 20px;
  font-weight: 500;
  margin-bottom: 8px;
}

.sub-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  white-space: nowrap; /* 强制不换行 */
}

/* 进度条装饰 */
.loading-bar-container {
  width: 200px;
  height: 4px;
  background: rgba(0, 0, 0, 0.5);
  margin-top: 20px;
  overflow: hidden;
}

.loading-bar {
  width: 0%;
  height: 100%;
  background: #00C8FF;
}

.loading-bar.filling {
  width: 100%;
  transition: width 2s linear; /* 2秒刚好填满 */
}
</style>

