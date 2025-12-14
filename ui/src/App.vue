<script setup>
import { ref, onMounted, watch, provide } from 'vue'
import { useRoute } from 'vue-router'
import LoadingScreen from './components/LoadingScreen.vue'
import ClickSpark from './components/ClickSpark.vue'
import TransitionMask from './components/TransitionMask.vue'
import { initSounds } from './utils/sound'

const route = useRoute()
const showLoading = ref(false)
const maskRef = ref(null)

// 通过 provide 让子组件可以访问遮罩转场
provide('maskRef', maskRef)

// 检查当前路由，只在主页显示加载动画（包括带URL参数的情况）
const checkShouldShowLoading = () => {
  // 主页路径是 '/'，其他页面都不显示加载动画
  const isHomePage = route.path === '/'
  const hasInviteParams = route.query.code && route.query.role && route.query.key
  
  console.log('[Loading] 当前路径:', route.path, '是否主页:', isHomePage, '是否有邀请参数:', hasInviteParams)
  
  if (isHomePage) {
    console.log('[Loading] 进入主页，显示加载动画')
    showLoading.value = true
  } else {
    console.log('[Loading] 非主页，不显示加载动画')
    showLoading.value = false
  }
}

const handleLoadingComplete = () => {
  console.log('[Loading] 加载动画完成')
  showLoading.value = false
}

// 监听路由变化
watch(() => route.path, (newPath) => {
  console.log('[Loading] 路由变化:', newPath)
  checkShouldShowLoading()
}, { immediate: false })

// 初始化
onMounted(() => {
  checkShouldShowLoading()
  // 初始化音效
  initSounds()
})
</script>

<template>
  <RouterView />
  <LoadingScreen v-if="showLoading" :on-complete="handleLoadingComplete" />
  <ClickSpark />
  <TransitionMask ref="maskRef" />
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Microsoft YaHei', 'SimHei', 'Arial', sans-serif;
  background-color: #121212;
  color: #e0e0e0;
  overflow-x: hidden;
  margin: 0;
  /* 默认状态：青色箭头 */
  cursor: url('/cursor/cursor-normal.svg') 0 0, auto;
}

#app {
  min-height: 100vh;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* === 全局鼠标指针设置 === */

/* 交互状态：黄色锁定框 */
/* 当鼠标悬停在 按钮、链接、输入框 上时 */
button, 
a, 
input[type="button"], 
input[type="submit"], 
.cursor-pointer,
.role-btn,
.avatar-preview,
.invite-link-copy-btn {
  /* x=16 y=16 表示准心在图片正中心 */
  cursor: url('/cursor/cursor-hover.svg') 16 16, pointer !important;
}

/* 文本选择状态：青色扫描针 */
/* 覆盖所有可能包含文本的标签 */
p, span, h1, h2, h3, h4, h5, h6, label, 
input[type="text"], 
input[type="password"], 
input[type="email"], 
textarea,
.invite-link-text {
  cursor: url('/cursor/cursor-text.svg') 16 16, text !important;
}

/* 特殊处理：输入框在非 hover 状态下也是文本光标 */
input:not([type="button"]):not([type="submit"]), textarea {
  cursor: url('/cursor/cursor-text.svg') 16 16, text !important;
}

/* 强制覆盖某些特定元素的 cursor */
.role-btn:hover, 
.create-button:hover,
.return-button:hover,
.confirm-button:hover,
.player-join-btn:hover,
.host-confirm-btn:hover {
  cursor: url('/cursor/cursor-hover.svg') 16 16, pointer !important;
}
</style>
