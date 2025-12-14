<template>
  <Transition name="fade">
    <div v-if="visible" class="confirm-modal-overlay" @click.self="handleCancel">
      <div class="confirm-modal-content">
        <div class="modal-header">
          <h3 class="modal-title">操作确认 // CONFIRM OPERATION</h3>
        </div>
        
        <div class="modal-body">
          <div class="confirm-icon">⚠</div>
          <p class="confirm-message">{{ message }}</p>
          <p v-if="subMessage" class="confirm-sub-message">{{ subMessage }}</p>
        </div>
        
        <div class="modal-actions">
          <button @click="handleCancel" class="modal-btn cancel-btn">
            CANCEL // 取消
          </button>
          <button @click="handleConfirm" class="modal-btn confirm-btn">
            CONFIRM // 确认
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { watch } from 'vue'
import { playButtonSound } from '@/utils/sound'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: '是否确认执行此操作？'
  },
  subMessage: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['confirm', 'cancel', 'update:visible'])

const handleConfirm = () => {
  playButtonSound() // 播放按钮音效
  emit('confirm')
  emit('update:visible', false)
}

const handleCancel = () => {
  playButtonSound() // 播放按钮音效
  emit('cancel')
  emit('update:visible', false)
}

// 监听 visible 变化，自动关闭
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 可以在这里添加打开动画
  }
})
</script>

<style scoped>
.confirm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.confirm-modal-content {
  background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-left: 4px solid #FFCD00;
  padding: 32px 40px;
  min-width: 480px;
  max-width: 600px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%);
}

.modal-header {
  margin-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 16px;
}

.modal-title {
  font-family: 'Arial', 'Consolas', monospace;
  font-size: 18px;
  font-weight: 700;
  color: #FFCD00;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.modal-body {
  text-align: center;
  padding: 20px 0;
}

.confirm-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #FFCD00;
  filter: drop-shadow(0 0 10px rgba(255, 205, 0, 0.5));
}

.confirm-message {
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  font-size: 16px;
  color: #fff;
  margin-bottom: 8px;
  line-height: 1.6;
  font-weight: 500;
}

.confirm-sub-message {
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
  margin-top: 12px;
}

.modal-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-btn {
  padding: 10px 24px;
  border: none;
  font-family: 'Arial', 'Consolas', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  clip-path: polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%);
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.confirm-btn {
  background: #FFCD00;
  color: #000;
  border: 1px solid #FFCD00;
}

.confirm-btn:hover {
  background: #FFD700;
  box-shadow: 0 0 15px rgba(255, 205, 0, 0.5);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .confirm-modal-content,
.fade-leave-active .confirm-modal-content {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.fade-enter-from .confirm-modal-content,
.fade-leave-to .confirm-modal-content {
  transform: scale(0.9);
  opacity: 0;
}
</style>



