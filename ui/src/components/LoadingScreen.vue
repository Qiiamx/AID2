<template>
  <Transition name="fade">
    <div v-if="isLoading" class="loading-screen">
      <!-- Logo区域 -->
      <div class="logo-container">
        <div class="logo-text">联锁博弈</div>
        <div class="logo-bar">
          <span class="logo-english">Chain Game Theory – Based on Arknights</span>
        </div>
      </div>
      
      <!-- 底部进度条区域 -->
      <div class="progress-section">
        <!-- 装饰线条 -->
        <div class="decorative-line">
          <div class="line-dot line-dot-left"></div>
          <div class="line-dot line-dot-right"></div>
        </div>
        
        <!-- 进度信息 -->
        <div class="progress-info">
          <div class="progress-label">
            <span class="loading-indicator">>></span>
            <span>LOADING - <span class="progress-percent">{{ Math.floor(progress) }}%</span></span>
          </div>
        </div>
        
        <!-- 进度条 -->
        <div class="progress-bar-wrapper">
          <div class="progress-bar" :style="{ width: progress + '%' }">
            <div class="progress-bar-glow"></div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  onComplete: {
    type: Function,
    default: () => {}
  }
})

const isLoading = ref(true)
const progress = ref(0)

onMounted(() => {
  startLoading()
})

const startLoading = () => {
  const pauseAt45 = 45 // 45%停顿点
  const pauseAt89 = 89 // 89%停顿点
  const pauseDuration = 400 // 停顿0.4秒
  
  // 阶段划分（非匀速）
  const stage1Duration = 800 // 0-45%：快速加载
  const stage2Duration = 1000 // 45-89%：中等速度
  const stage3Duration = 400 // 89-100%：快速完成
  
  let startTime = Date.now()
  let currentStage = 1 // 1: 0-45%, 2: 停顿45%, 3: 45-89%, 4: 停顿89%, 5: 89-100%
  let stageStartTime = Date.now()
  
  const animate = () => {
    const now = Date.now()
    let targetProgress = 0
    let shouldContinue = true
    
    switch (currentStage) {
      case 1: // 0-45%
        const stage1Elapsed = now - stageStartTime
        if (stage1Elapsed < stage1Duration) {
          targetProgress = (stage1Elapsed / stage1Duration) * pauseAt45
        } else {
          targetProgress = pauseAt45
          currentStage = 2
          stageStartTime = now
        }
        break
        
      case 2: // 45%停顿
        const pause1Elapsed = now - stageStartTime
        targetProgress = pauseAt45
        if (pause1Elapsed >= pauseDuration) {
          currentStage = 3
          stageStartTime = now
        }
        break
        
      case 3: // 45-89%
        const stage2Elapsed = now - stageStartTime
        if (stage2Elapsed < stage2Duration) {
          targetProgress = pauseAt45 + (stage2Elapsed / stage2Duration) * (pauseAt89 - pauseAt45)
        } else {
          targetProgress = pauseAt89
          currentStage = 4
          stageStartTime = now
        }
        break
        
      case 4: // 89%停顿
        const pause2Elapsed = now - stageStartTime
        targetProgress = pauseAt89
        if (pause2Elapsed >= pauseDuration) {
          currentStage = 5
          stageStartTime = now
        }
        break
        
      case 5: // 89-100%
        const stage3Elapsed = now - stageStartTime
        if (stage3Elapsed < stage3Duration) {
          targetProgress = pauseAt89 + (stage3Elapsed / stage3Duration) * (100 - pauseAt89)
        } else {
          targetProgress = 100
          shouldContinue = false
        }
        break
    }
    
    progress.value = Math.min(targetProgress, 100)
    
    if (shouldContinue && progress.value < 100) {
      requestAnimationFrame(animate)
    } else {
      // 加载完成，延迟一点后淡出
      setTimeout(() => {
        isLoading.value = false
        setTimeout(() => {
          props.onComplete()
        }, 300) // 等待淡出动画完成
      }, 200)
    }
  }
  
  animate()
}
</script>

<style scoped>
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #121212;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  cursor: wait;
  user-select: none;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 80px;
  animation: pulse-slow 3s infinite;
}

.logo-text {
  font-size: 56px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 6px;
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
}

.logo-bar {
  position: relative;
  width: 100%;
  max-width: 800px;
  height: 2px;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.logo-english {
  position: absolute;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 2px;
  background-color: #121212;
  padding: 0 12px;
  font-family: 'Arial', sans-serif;
  font-weight: 300;
  text-transform: uppercase;
  white-space: nowrap; /* 防止换行 */
  left: 50%;
  transform: translateX(-50%); /* 确保居中 */
}

/* 底部进度区域 */
.progress-section {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  padding: 0 48px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 装饰线条 */
.decorative-line {
  position: relative;
  width: 100%;
  height: 1px;
  background-color: rgba(255, 255, 255, 0.2);
  margin-bottom: 12px;
}

.line-dot {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 4px;
  background-color: #ffffff;
  border-radius: 0;
}

.line-dot-left {
  left: 0;
}

.line-dot-right {
  right: 0;
}

/* 进度信息 */
.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Arial', 'Consolas', monospace;
  letter-spacing: 1px;
}

.progress-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-indicator {
  color: #00c8ff;
  animation: blink 1s infinite;
  font-weight: bold;
}

.progress-percent {
  color: #ffffff;
  font-size: 18px;
  font-weight: bold;
  margin-left: 4px;
}

/* 进度条 */
.progress-bar-wrapper {
  width: 100%;
  height: 4px;
  background-color: rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #00c8ff 0%, #4dd0ff 100%);
  transition: width 0.1s ease-out;
  position: relative;
  box-shadow: 0 0 15px rgba(0, 200, 255, 0.6);
}

.progress-bar-glow {
  position: absolute;
  right: 0;
  top: 0;
  width: 12px;
  height: 100%;
  background: #ffffff;
  box-shadow: 0 0 12px 3px rgba(0, 200, 255, 0.9);
}

/* 动画 */
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.85;
  }
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* 淡入淡出动画 - 增强模糊效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.8s ease-in-out, filter 0.8s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  filter: blur(10px);
}
</style>
