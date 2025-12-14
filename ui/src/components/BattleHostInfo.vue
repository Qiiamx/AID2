<template>
  <div 
    class="host-info-panel" 
    :class="{ 'clickable': isHost }"
    @click="handleClick"
  >
    <div class="info-content">
      <div class="text-col">
        <div class="role-label">管理员 // HOST</div>
        <div class="host-name">{{ hostInfo.nickname || 'UNKNOWN' }}</div>
      </div>
      <div class="avatar-box">
        <img :src="hostInfo.avatar || '/default_avatar.png'" class="avatar-img" @error="handleImageError">
        <div class="corner-mark top-left"></div>
        <div class="corner-mark bottom-right"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  hostInfo: {
    type: Object,
    default: () => ({ nickname: 'Dr. Kaltsit', avatar: '' })
  },
  isHost: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['show-invite']);

const handleClick = () => {
  if (props.isHost) {
    emit('show-invite');
  }
};

const handleImageError = (e) => {
  e.target.style.display = 'none'; // 图片挂了就隐藏
};
</script>

<style scoped>
.host-info-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 20px;
  clip-path: polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px);
  z-index: 100;
  transition: all 0.3s ease;
}

.host-info-panel.clickable {
  cursor: pointer;
}

.host-info-panel:hover {
  border-color: #FFD700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.2);
}

.info-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.text-col {
  text-align: right;
}

.role-label {
  font-family: 'Rajdhani', sans-serif;
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

.avatar-box {
  position: relative;
  width: 40px; /* 缩小尺寸 */
  height: 40px;
  background: #333;
  border: 1px solid #555;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.corner-mark {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #fff;
  transition: background 0.3s;
}

.top-left { top: -1px; left: -1px; }

.bottom-right { bottom: -1px; right: -1px; }

.host-info-panel:hover .corner-mark {
  background: #FFD700;
}
</style>








