<template>
  <transition name="fade-out">
    <div class="public-pool-container" v-if="shouldShow && openingOperators && openingOperators.length > 0">
    <div class="pool-label">公共牌区 // PUBLIC POOL</div>
    <div class="pool-cards">
      <div 
        v-for="(op, index) in openingOperators" 
        :key="index"
        class="mini-card"
        :class="{ 'hovered': hoveredIndex === index }"
        @mouseenter="hoveredIndex = index"
        @mouseleave="hoveredIndex = null"
      >
        <div class="card-inner">
          <!-- 前两个干员：所有人显示完整信息 -->
          <template v-if="index < 2">
            <img :src="op.avatar" class="card-avatar" :alt="op.name" @error="handleImageError">
            <div class="card-info">
              <div class="card-name">{{ op.name }}</div>
              <div class="card-stars">{{ '★'.repeat(op.rarity || 0) }}</div>
              <div class="card-profession">{{ op.professionCn || getClassCn(op.profession) }}</div>
            </div>
          </template>
          <!-- 第3个干员：选手显示职业图标+未知信息，主持人/观众显示头像+完整信息 -->
          <template v-else-if="index === 2">
            <!-- 选手视角：显示职业图标 -->
            <img 
              v-if="shouldHideInfo(index)" 
              :src="getProfessionIconPath(op.profession)" 
              class="card-avatar profession-icon" 
              :alt="getClassCn(op.profession)"
            >
            <!-- 主持人/观众视角：显示头像 -->
            <img 
              v-else 
              :src="op.avatar" 
              class="card-avatar" 
              :alt="op.name" 
              @error="handleImageError"
            >
            <div class="card-info">
              <!-- 选手视角：只显示"未知+职业" -->
              <template v-if="shouldHideInfo(index)">
                <div class="card-name">未知{{ getClassCn(op.profession) }}</div>
                <div class="card-stars">???</div>
                <div class="card-profession">{{ getClassCn(op.profession) }}</div>
              </template>
              <!-- 主持人/观众视角：显示完整信息 -->
              <template v-else>
                <div class="card-name">{{ op.name }}</div>
                <div class="card-stars">{{ '★'.repeat(op.rarity || 0) }}</div>
                <div class="card-profession">{{ op.professionCn || getClassCn(op.profession) }}</div>
              </template>
            </div>
          </template>
        </div>
        <!-- 悬停时显示详细信息 -->
        <div v-if="hoveredIndex === index" class="card-detail-popup">
          <template v-if="index < 2 || !shouldHideInfo(index)">
            <!-- 前两个干员或主持人/观众视角的第3个干员：显示完整信息 -->
            <div class="detail-name">{{ op.name }}</div>
            <div class="detail-stars">{{ '★'.repeat(op.rarity || 0) }}</div>
            <div class="detail-profession">{{ op.professionCn || getClassCn(op.profession) }}-{{ op.subClass }}</div>
          </template>
          <template v-else>
            <!-- 选手视角的第3个干员：只显示职业信息 -->
            <div class="detail-name">未知{{ getClassCn(op.profession) }}</div>
            <div class="detail-stars">???</div>
            <div class="detail-profession">{{ getClassCn(op.profession) }}-???</div>
          </template>
        </div>
      </div>
    </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  openingOperators: {
    type: Array,
    default: () => []
  },
  gamePhase: {
    type: String,
    default: 'OPENING'
  },
  userRole: {
    type: String,
    default: 'SPECTATOR'
  },
  isMatchEnded: {
    type: Boolean,
    default: false
  }
})

const hoveredIndex = ref(null)

// 只在开局阶段结束后显示，但在攻略准备阶段淡出消失
const shouldShow = computed(() => {
  // 开局阶段不显示
  if (props.gamePhase === 'OPENING' || props.gamePhase === 'OPENING_SHOW') {
    return false
  }
  // 攻略准备阶段及之后不显示
  if (props.gamePhase === 'STRATEGY_PREP' || props.gamePhase === 'STRATEGY_TRANSITION' || props.gamePhase === 'STRATEGY_COMPLETED') {
    return false
  }
  return true
})

// 判断是否应该隐藏第3个干员的信息（选手和观众视角）
const shouldHideInfo = (index) => {
  // 如果比赛已结束，全员可见，不隐藏
  if (props.isMatchEnded) return false
  // 【修改】选手和观众都隐藏第3张
  return (props.userRole === 'PLAYER' || props.userRole === 'SPECTATOR') && index === 2
}

const getClassCn = (professionEn) => {
  const map = {
    'SNIPER': '狙击',
    'CASTER': '术师',
    'GUARD': '近卫',
    'DEFENDER': '重装',
    'MEDIC': '医疗',
    'VANGUARD': '先锋',
    'SUPPORTER': '辅助',
    'SPECIALIST': '特种'
  }
  return map[professionEn] || professionEn || '干员'
}

const getProfessionIconPath = (profession) => {
  const map = {
    'SNIPER': '/images/狙击.png',
    'CASTER': '/images/术师.png',
    'GUARD': '/images/近卫.png',
    'DEFENDER': '/images/重装.png',
    'MEDIC': '/images/医疗.png',
    'VANGUARD': '/images/先锋.png',
    'SUPPORTER': '/images/辅助.png',
    'SPECIALIST': '/images/特种.png'
  }
  return map[profession] || '/images/近卫.png'
}

const handleImageError = (e) => {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.public-pool-container {
  position: absolute;
  top: 80px; /* 在阶段指示器和主持人信息下方 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none; /* 容器不阻挡点击，但子元素可以交互 */
  max-width: 600px;
}

.pool-label {
  font-family: 'Rajdhani', 'Noto Sans SC', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
}

.pool-cards {
  display: flex;
  gap: 12px;
  pointer-events: auto; /* 卡片可以交互 */
}

.mini-card {
  width: 70px;
  height: 90px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  opacity: 0.85;
}

.mini-card:hover,
.mini-card.hovered {
  opacity: 1;
  transform: translateY(-5px) scale(1.1);
  z-index: 200;
}

.card-inner {
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 4px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(5px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  transition: all 0.3s;
}

.mini-card:hover .card-inner,
.mini-card.hovered .card-inner {
  border-color: rgba(0, 255, 255, 0.8);
  box-shadow: 0 4px 16px rgba(0, 255, 255, 0.4);
}

.card-avatar {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.card-avatar.profession-icon {
  object-fit: contain;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
}

.card-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.card-name {
  font-size: 10px;
  font-weight: bold;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  line-height: 1.2;
}

.card-stars {
  font-size: 8px;
  color: #ffd700;
  line-height: 1;
}

.card-profession {
  font-size: 8px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1;
}

/* 详细信息弹窗 */
.card-detail-popup {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.95);
  border: 2px solid rgba(0, 255, 255, 0.8);
  border-radius: 6px;
  padding: 12px 16px;
  min-width: 120px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  z-index: 300;
  pointer-events: none;
}

.card-detail-popup::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(0, 255, 255, 0.8);
}

.detail-name {
  font-size: 14px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 4px;
}

.detail-stars {
  font-size: 12px;
  color: #ffd700;
  margin-bottom: 4px;
}

.detail-profession {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

/* 淡出动画 */
.fade-out-enter-active,
.fade-out-leave-active {
  transition: opacity 0.5s ease;
}

.fade-out-enter-from,
.fade-out-leave-to {
  opacity: 0;
}
</style>

