<template>
  <div class="user-avatar-container" :data-role="role" :data-team="team">
    <div 
      class="avatar-box"
      :class="[sizeClasses, { 'has-avatar': avatar || defaultIcon }]"
    >
      <img v-if="avatar" :src="avatar" class="avatar-image" alt="头像" />
      <img v-else-if="defaultIcon" :src="defaultIcon" class="avatar-image" alt="默认图标" />
      <div v-else class="avatar-placeholder">
        <span v-if="size === 'lg'" class="placeholder-large">NO DATA</span>
        <span v-else class="placeholder-small">EMPTY</span>
      </div>
      <div v-if="size !== 'sm'" class="avatar-corner"></div>
      <div class="avatar-indicator"></div>
    </div>
    <div class="avatar-name" :class="textClasses">
      {{ displayNickname }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  avatar: {
    type: String,
    default: ''
  },
  nickname: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: 'SPECTATOR' // 'HOST', 'PLAYER', 'SPECTATOR'
  },
  team: {
    type: String,
    default: '' // 'A' 或 'B'，用于区分队伍A和队伍B
  },
  index: {
    type: Number,
    default: 0
  },
  size: {
    type: String,
    default: 'md' // 'lg' (Host), 'md' (Player), 'sm' (Viewer)
  }
})

// 计算尺寸样式
const sizeClasses = computed(() => {
  switch (props.size) {
    case 'lg':
      return 'avatar-lg' // 主持人
    case 'sm':
      return 'avatar-sm' // 观众
    default:
      return 'avatar-md' // 选手
  }
})

// 计算文字大小
const textClasses = computed(() => {
  switch (props.size) {
    case 'lg':
      return 'name-lg'
    case 'sm':
      return 'name-sm'
    default:
      return 'name-md'
  }
})

// 计算默认图标
const defaultIcon = computed(() => {
  if (props.avatar) return null // 如果有自定义头像，不使用默认图标
  
  switch (props.role) {
    case 'HOST':
      return '/images/主持人.png'
    case 'PLAYER':
      // 根据team属性判断是队伍A还是队伍B
      if (props.team === 'A') {
        return '/images/队伍A.png'
      } else if (props.team === 'B') {
        return '/images/队伍B.png'
      }
      // 默认显示队伍A图标
      return '/images/队伍A.png'
    case 'SPECTATOR':
      return '/images/观众.png'
    default:
      return null
  }
})

// 计算默认昵称 (主持人A, 选手B...)
const displayNickname = computed(() => {
  if (props.nickname) return props.nickname

  const charCode = String.fromCharCode(65 + props.index) // 0->A, 1->B
  let prefix = ''
  if (props.role === 'HOST') {
    prefix = '主持人'
  } else if (props.role === 'PLAYER') {
    prefix = '选手'
  } else {
    prefix = '观众'
  }

  return `${prefix}${charCode}`
})
</script>

<style scoped>
.user-avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: default;
}

.avatar-box {
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.6);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.3s ease, background-color 0.3s ease;
  will-change: border-color, transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* 根据角色和队伍显示不同的hover颜色 */
.user-avatar-container:hover .avatar-box {
  /* 默认颜色（观众） */
  border-color: #32FF64;
}

/* 主持人：黄色 */
.user-avatar-container[data-role="HOST"]:hover .avatar-box {
  border-color: #FFCD00;
}

/* 队伍A：蓝色 */
.user-avatar-container[data-role="PLAYER"][data-team="A"]:hover .avatar-box {
  border-color: #00C8FF;
}

/* 队伍B：红色 */
.user-avatar-container[data-role="PLAYER"][data-team="B"]:hover .avatar-box {
  border-color: #FF3333;
}

/* 观众：绿色 */
.user-avatar-container[data-role="SPECTATOR"]:hover .avatar-box {
  border-color: #32FF64;
}

/* 尺寸定义 */
.avatar-lg {
  width: 128px;
  height: 128px;
  clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%);
}

.avatar-md {
  width: 96px;
  height: 96px;
  clip-path: polygon(0 0, 100% 0, 100% 85%, 85% 100%, 0 100%);
}

.avatar-sm {
  width: 40px;
  height: 40px;
  border-radius: 0;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.9);
  transition: filter 0.3s ease;
  will-change: filter;
  transform: translateZ(0);
}

.user-avatar-container:hover .avatar-image {
  filter: brightness(1.1);
}

.avatar-placeholder {
  color: rgba(255, 255, 255, 0.3);
  font-family: 'Arial', 'Consolas', monospace;
  font-weight: 700;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.3;
}

.placeholder-large {
  font-size: 20px;
}

.placeholder-small {
  font-size: 8px;
}

.avatar-corner {
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  clip-path: polygon(0 0, 100% 0, 100% 100%);
}

.avatar-indicator {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background: #00C8FF;
  box-shadow: 0 0 8px rgba(0, 200, 255, 0.8);
}

.avatar-sm .avatar-indicator {
  width: 4px;
  height: 4px;
  bottom: 2px;
  right: 2px;
}

/* 文字样式 */
.avatar-name {
  font-family: 'Microsoft YaHei', 'SimHei', 'Arial', sans-serif;
  letter-spacing: 2px;
  text-align: center;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
  transition: color 0.3s ease;
  padding: 0 8px;
  will-change: color;
  transform: translateZ(0);
}

/* 根据角色和队伍显示不同的hover文字颜色 */
.user-avatar-container:hover .avatar-name {
  /* 默认颜色（观众） */
  color: #32FF64;
}

.user-avatar-container[data-role="HOST"]:hover .avatar-name {
  color: #FFCD00;
}

.user-avatar-container[data-role="PLAYER"][data-team="A"]:hover .avatar-name {
  color: #00C8FF;
}

.user-avatar-container[data-role="PLAYER"][data-team="B"]:hover .avatar-name {
  color: #FF3333;
}

.user-avatar-container[data-role="SPECTATOR"]:hover .avatar-name {
  color: #32FF64;
}

.name-lg {
  font-size: 20px;
  color: #ffffff;
  font-weight: 700;
  max-width: 150px;
}

.name-md {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  max-width: 120px;
}

.name-sm {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  max-width: 60px;
}
</style>

