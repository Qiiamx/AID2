<template>
  <div class="click-sparks-container">
    <div 
      v-for="spark in sparks" 
      :key="spark.id"
      class="spark"
      :style="{ left: spark.x + 'px', top: spark.y + 'px' }"
    >
      <div class="spark-ring"></div>
      <div class="spark-core"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const sparks = ref([])
let idCounter = 0

const handleClick = (e) => {
  const id = idCounter++
  const newSpark = {
    id,
    x: e.clientX,
    y: e.clientY
  }
  
  sparks.value.push(newSpark)
  
  // 动画结束后移除 (600ms后)
  setTimeout(() => {
    sparks.value = sparks.value.filter(s => s.id !== id)
  }, 600)
}

onMounted(() => {
  window.addEventListener('click', handleClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClick)
})
</script>

<style scoped>
.click-sparks-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 99999;
}

.spark {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* 核心光点 */
.spark-core {
  width: 8px;
  height: 8px;
  background: #00C8FF;
  border-radius: 50%;
  animation: core-anim 0.4s ease-out forwards;
  box-shadow: 0 0 10px #00C8FF;
}

/* 扩散的波纹环 */
.spark-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0px;
  height: 0px;
  border: 2px solid #00C8FF;
  border-radius: 50%;
  animation: ring-anim 0.5s ease-out forwards;
  opacity: 1;
}

@keyframes core-anim {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0); opacity: 0; }
}

@keyframes ring-anim {
  0% { width: 0px; height: 0px; opacity: 1; border-width: 4px; }
  100% { width: 60px; height: 60px; opacity: 0; border-width: 0px; }
}
</style>




