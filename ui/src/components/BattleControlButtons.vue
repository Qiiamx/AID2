<template>
  <div 
    class="control-deck-area"
    :class="[
      `role-${role}`, 
      { 'is-hovered': isHovered },
      role === 'PLAYER' && team ? `team-${team}` : ''
    ]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    
    <div v-if="role === 'HOST'" class="host-panel">
      <div class="deck-label">管理员指令 // ADMIN CONSOLE</div>
      
      <!-- 开局阶段：显示开局按钮 -->
      <div v-if="gamePhase === 'OPENING'" class="btn-group">
        <button 
          class="ak-btn btn-host-start"
          :disabled="isPaused"
          @click="$emit('start-match')"
        >
          <span class="icon">▶</span>
          <span class="text">开局 // INITIATE</span>
        </button>
      </div>
      
      <!-- 等待阶段（双方都终止后）：显示重新开局和重新开始博弈按钮 -->
      <!-- 【关键修复】必须放在普通等待阶段之前，因为 Vue 的 v-else-if 是按顺序执行的 -->
      <!-- 更具体的条件（比赛结束）必须优先于通用条件（普通等待） -->
      <div v-else-if="gamePhase === 'WAITING' && (isMatchEnded || (role === 'HOST' && isTerminated && opponentTerminated))" class="btn-group strategy-complete-buttons">
        <button 
          class="ak-btn btn-restart-game"
          :disabled="isPaused"
          @click="$emit('restart-game')"
        >
          <span class="text">重新开局</span>
        </button>
        <button 
          class="ak-btn btn-restart-bidding"
          :disabled="isPaused"
          @click="$emit('restart-bidding')"
        >
          <span class="text">重新开始博弈</span>
        </button>
      </div>
      
      <!-- 等待阶段：显示开始博弈/下一轮按钮 -->
      <div v-else-if="gamePhase === 'WAITING'" class="btn-group">
        <button 
          class="ak-btn btn-host-next"
          :disabled="isBidding || isPaused"
          @click="$emit('start-bidding')"
        >
          <span class="text">{{ isFirstRound ? '开始博弈 // START BIDDING' : '下一轮博弈 // NEXT ROUND' }}</span>
        </button>
      </div>
      
      <!-- 博弈阶段、结果展示阶段、冷却阶段：显示暂停/继续按钮 -->
      <div v-else-if="['BIDDING', 'RESULT_SHOW', 'COOLDOWN'].includes(gamePhase)" class="btn-group">
        <!-- 暂停/继续按钮 -->
        <button 
          class="ak-btn"
          :class="isPaused ? 'btn-resume' : 'btn-pause'"
          @click="isPaused ? $emit('resume') : $emit('pause')"
        >
          <span class="text">{{ isPaused ? '继续 // RESUME' : '暂停 // PAUSE' }}</span>
        </button>
        
        <!-- 博弈阶段：显示开始博弈/下一轮按钮 -->
        <button 
          v-if="gamePhase === 'BIDDING'"
          class="ak-btn btn-host-next"
          :disabled="isBidding || isPaused"
          @click="$emit('start-bidding')"
        >
          <span class="text">{{ isBidding ? 'BIDDING...' : (isFirstRound ? '开始博弈 // START BIDDING' : '下一轮博弈 // NEXT ROUND') }}</span>
        </button>
        
        <!-- 结果展示和冷却阶段：显示自动状态提示 -->
        <div v-else class="auto-status-text">
          {{ gamePhase === 'RESULT_SHOW' ? '结果展示中...' : '即将开始下一轮...' }}
        </div>
      </div>
    </div>

    <div v-if="role === 'PLAYER'" class="player-panel">
      <div class="deck-label">战术终端 // TACTICAL INPUT</div>

      <!-- 开局阶段：不显示按钮 -->
      <div v-if="gamePhase === 'OPENING'" class="waiting-text">
        WAITING FOR MATCH START...
      </div>

      <!-- 等待阶段：只显示等待提示 -->
      <div v-else-if="gamePhase === 'WAITING'" class="waiting-actions">
        <!-- 如果已终止，显示终止状态 -->
        <div v-if="isTerminated" class="terminated-status">
          <img src="/images/停止.png" class="terminated-icon" alt="停止">
          <span>已终止 // TERMINATED</span>
        </div>
        
        <!-- 未终止时只显示等待提示 -->
        <div v-else class="waiting-text">
          WAITING FOR HOST TO START BIDDING...
        </div>
      </div>

      <!-- 博弈阶段：显示操作按钮（进入博弈阶段就显示，但根据 isBidding 控制可用性） -->
      <div v-else-if="gamePhase === 'BIDDING'" class="player-actions">
        
        <!-- 如果已终止，显示终止状态 -->
        <div v-if="isTerminated" class="terminated-status">
          <img src="/images/停止.png" class="terminated-icon" alt="停止">
          <span>已终止 // TERMINATED</span>
        </div>
        
        <!-- 未终止时显示操作按钮（休息、博弈抓取、终止） -->
        <template v-else>
          <button 
            class="ak-btn btn-rest" 
            :disabled="!isBidding || playerHasChosen || isTerminated || (isSingleSideMode && isBidding) || isPaused"
            @click="$emit('rest')"
          >
            <div class="main-text">休息</div>
          </button>

          <div class="bid-wrapper">
             <div class="bid-amount-selector" :class="{ 'locked': isTerminated || (isSingleSideMode && isBidding) || isPaused }">
               <span class="label">CP:</span>
               <div class="bid-buttons-grid">
                 <button
                   v-for="amount in bidAmounts"
                   :key="amount"
                   class="bid-amount-btn"
                   :class="{ 
                     'active': selectedBidAmount === amount,
                     'locked-amount': isTerminated || (isSingleSideMode && isBidding && amount !== 10) || isPaused
                   }"
                   :disabled="!isBidding || playerHasChosen || isTerminated || (isSingleSideMode && isBidding && amount !== 10) || isPaused"
                   @click="selectAmount(amount)"
                 >
                   {{ amount }}
                 </button>
               </div>
               <span v-if="isTerminated || (isSingleSideMode && isBidding) || isPaused" class="lock-icon">🔒</span>
             </div>
             <button 
               class="ak-btn btn-capture" 
               :disabled="!isBidding || playerHasChosen || !selectedBidAmount || isTerminated || (isSingleSideMode && isBidding && selectedBidAmount !== 10) || isPaused"
               @click="handleBidClick"
             >
              <div class="glitch-text">博弈抓取</div>
             </button>
          </div>

          <!-- 【新增】终止按钮（博弈回合内可见且可用） -->
          <button 
            class="ak-btn btn-terminate" 
            :disabled="!isBidding || playerHasChosen || isTerminated || isPaused"
            @click="$emit('terminate')"
          >
            <div class="main-text">终止</div>
          </button>

        </template>
        
        <!-- 选择提示字幕（仅选手可见） -->
        <div v-if="playerHasChosen && playerChoiceText" class="choice-hint">
          {{ playerChoiceText }}
        </div>

      </div>
      
      <!-- 【已删除】攻略准备阶段相关UI已移除 -->

      <!-- 其他情况（不应该出现） -->
      <div v-else class="waiting-text">
        WAITING FOR SIGNAL...
      </div>
    </div>

    <!-- 观众视角：不显示任何操作按钮区域 -->

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  role: { type: String, required: true }, // 'HOST', 'PLAYER', 'SPECTATOR'
  isBidding: { type: Boolean, default: false }, // 是否正在博弈中
  isFirstRound: { type: Boolean, default: true }, // 是否是第一轮
  gamePhase: { type: String, default: 'OPENING' }, // 'OPENING' | 'BIDDING' | 'TERMINATED' | 'WAITING'
  team: { type: String, default: '' }, // 'A' 或 'B'，用于区分队伍A和B的选手
  playerHasChosen: { type: Boolean, default: false }, // 选手是否已选择
  playerChoiceText: { type: String, default: '' }, // 选择的提示文字
  isTerminated: { type: Boolean, default: false }, // 自己是否已终止
  opponentTerminated: { type: Boolean, default: false }, // 对手是否已终止
  isMatchEnded: { type: Boolean, default: false }, // 比赛是否完全结束（双方都终止）
  isSingleSideMode: { type: Boolean, default: false }, // 是否处于单边模式（真正的单边模式，不是预单边模式）
  isPaused: { type: Boolean, default: false } // 【新增】是否已暂停
});

const emit = defineEmits(['start-match', 'start-bidding', 'bid', 'select-amount', 'rest', 'terminate', 'restart-game', 'restart-bidding', 'pause', 'resume']);
const isHovered = ref(false);

// 固定档位：1、2、3、4、5、10、15、20
const bidAmounts = [1, 2, 3, 4, 5, 10, 15, 20]

// 选中的出价金额
const selectedBidAmount = ref(null)

// 【优化】监听新回合开始，根据单边模式状态设置选择
watch(() => props.isBidding, (isBidding) => {
  if (isBidding) {
    if (props.opponentTerminated) {
      // 单边模式：强制锁定为 10
      selectedBidAmount.value = 10
      console.log('[BattleControlButtons] 单边模式：强制锁定为 10')
    } else {
      // 正常模式：重置选择
      selectedBidAmount.value = null
    }
  }
})

// 【修改】移除对手终止状态变化的监听
// 原因：单边模式应该从下一回合开始生效，而不是当前回合
// 当前回合不受单边模式限制，所以不需要在对手终止时立即强制锁定

const selectAmount = (amount) => {
  selectedBidAmount.value = amount
  emit('select-amount', amount) // 通知父组件 -> 通知后端
}

const handleBidClick = () => {
  // 【修改】移除单边模式限制：当前回合不受单边模式限制
  // 单边模式限制将在结算时生效（下一回合）
  if (selectedBidAmount.value && selectedBidAmount.value > 0) {
    emit('bid', selectedBidAmount.value)
    // 不清空选择，允许重复出价
  }
}
</script>

<style scoped>
/* =========================================
   容器定位 (屏幕中心偏下)
   ========================================= */
.control-deck-area {
  position: absolute;
  /* 垂直位置：75% 处 (整体下移) */
  top: 75%; 
  left: 50%;
  transform: translate(-50%, -50%) rotateX(45deg); /* 更大的后仰角度 */
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1); /* 缓慢过渡动画 */
  
  width: 600px;
  padding: 20px;
  
  /* 背景样式 (操作台底座) */
  background: rgba(20, 25, 30, 0.9);
  backdrop-filter: blur(5px);
  border: 1px solid #444;
  border-bottom: 4px solid #666;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  
  pointer-events: auto;
  z-index: 100; /* 提高 z-index，确保在 BattleCenterConsole 之上 */
  
  /* 描边光晕层（伪元素） */
  position: relative;
}

/* 鼠标悬停时：减小后仰角度 */
.control-deck-area.is-hovered {
  transform: translate(-50%, -50%) rotateX(25deg); /* 悬停时角度减小 */
}

/* 描边光晕层 */
.control-deck-area::before {
  content: '';
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border: 2px solid transparent;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: -1;
}

/* 根据身份显示不同颜色的描边光效 */
.control-deck-area.role-HOST.is-hovered::before {
  opacity: 1;
  border-color: #FFD700; /* 主持人：黄色 */
  filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.6))
          drop-shadow(0 0 20px rgba(255, 215, 0, 0.4))
          drop-shadow(0 0 30px rgba(255, 215, 0, 0.3));
}

/* 队伍A选手：蓝色 */
.control-deck-area.role-PLAYER.team-A.is-hovered::before {
  opacity: 1;
  border-color: #00AEEF; /* 队伍A：蓝色 */
  filter: drop-shadow(0 0 10px rgba(0, 174, 239, 0.6))
          drop-shadow(0 0 20px rgba(0, 174, 239, 0.4))
          drop-shadow(0 0 30px rgba(0, 174, 239, 0.3));
}

/* 队伍B选手：红色 */
.control-deck-area.role-PLAYER.team-B.is-hovered::before {
  opacity: 1;
  border-color: #D50000; /* 队伍B：红色 */
  filter: drop-shadow(0 0 10px rgba(213, 0, 0, 0.6))
          drop-shadow(0 0 20px rgba(213, 0, 0, 0.4))
          drop-shadow(0 0 30px rgba(213, 0, 0, 0.3));
}

.control-deck-area.role-SPECTATOR.is-hovered::before {
  opacity: 1;
  border-color: #32FF64; /* 观众：绿色 */
  filter: drop-shadow(0 0 10px rgba(50, 255, 100, 0.6))
          drop-shadow(0 0 20px rgba(50, 255, 100, 0.4))
          drop-shadow(0 0 30px rgba(50, 255, 100, 0.3));
}

.deck-label {
  font-family: 'Rajdhani', sans-serif;
  font-size: 10px;
  color: #666;
  border-bottom: 1px solid #333;
  margin-bottom: 15px;
  padding-bottom: 5px;
  text-align: right;
  letter-spacing: 1px;
}

/* =========================================
   通用按钮样式
   ========================================= */
.ak-btn {
  border: none; 
  outline: none; 
  cursor: pointer;
  font-family: 'Noto Sans SC', sans-serif;
  color: #fff;
  transition: all 0.2s;
  /* 机能风切角 */
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.ak-btn:active { 
  transform: translateY(2px); 
  filter: brightness(0.8); 
}

.ak-btn:disabled { 
  cursor: not-allowed; 
  opacity: 0.6; 
  filter: grayscale(1); 
}

/* =========================================
   主持人按钮
   ========================================= */
.host-panel { 
  text-align: center; 
}

.btn-group { 
  display: flex; 
  justify-content: center; 
  align-items: center;
  gap: 20px; 
}

.auto-status-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  letter-spacing: 1px;
  padding: 10px 20px;
}

/* 开局按钮 (白色) */
.btn-host-start {
  background: #fff; 
  color: #000;
  padding: 15px 50px; 
  font-size: 18px; 
  font-weight: 900;
  border-bottom: 4px solid #aaa;
}

.btn-host-start:hover:not(:disabled) { 
  background: #00AEEF; 
  color: #fff; 
  border-bottom-color: #0077a3; 
}

/* 下一轮按钮 (金色) */
.btn-host-next {
  background: #FFD700; 
  color: #000;
  padding: 15px 50px; 
  font-size: 18px; 
  font-weight: 900;
  border-bottom: 4px solid #FBC02D;
}

.btn-host-next:hover:not(:disabled) { 
  background: #FFEA00; 
}

/* 【已删除】攻略准备阶段相关按钮样式已移除 */

/* 重新开局和重新开始博弈按钮 */
.btn-restart-game,
.btn-restart-bidding {
  background: #FFD700; 
  color: #000;
  padding: 15px 40px; 
  font-size: 16px; 
  font-weight: 900;
  border-bottom: 4px solid #FBC02D;
}

.btn-restart-game:hover:not(:disabled),
.btn-restart-bidding:hover:not(:disabled) { 
  background: #FFEA00; 
}

.btn-host-start .icon,
.btn-host-next .icon,
.btn-restart-game .icon,
.btn-restart-bidding .icon {
  margin-right: 8px;
}

/* =========================================
   选手按钮 (三足鼎立)
   ========================================= */
.player-actions {
  display: flex; 
  align-items: stretch; 
  justify-content: center; 
  gap: 15px; 
  height: 90px;
}

/* 1. 休息按钮 (绿色, 左侧) */
.btn-rest {
  flex: 0 0 100px;
  background: #2E7D32; 
  border-bottom: 4px solid #1B5E20;
  display: flex; 
  flex-direction: column; 
  justify-content: center; 
  align-items: center;
}

.btn-rest:hover:not(:disabled) { 
  background: #388E3C; 
  box-shadow: 0 0 15px rgba(46, 125, 50, 0.4); 
}

.btn-rest:disabled {
  background: #333;
  border-color: #666;
  color: #666;
  opacity: 0.5;
  cursor: not-allowed;
}

/* 2. 博弈抓取组合 (黄色, 中间, 最大) */
.bid-wrapper {
  flex: 1; /* 占据剩余空间 */
  display: flex; 
  flex-direction: row; /* 改为水平布局 */
  gap: 10px;
  align-items: stretch; /* 确保两个子元素高度一致 */
}

.bid-amount-selector {
  flex: 0 0 auto; /* 不伸缩，根据内容自适应 */
  background: #000; 
  border: 1px solid #444; 
  border-bottom: 4px solid #444; /* 添加底部边框，与按钮保持一致 */
  padding: 8px;
  padding-bottom: 4px; /* 调整底部padding，考虑边框 */
  display: flex; 
  flex-direction: column;
  gap: 0; /* 移除gap，改用margin控制间距 */
  position: relative;
  min-width: 200px; /* 设置最小宽度 */
  height: 90px; /* 明确设置高度为90px，与按钮一致 */
  box-sizing: border-box; /* 确保padding和border包含在高度内 */
  justify-content: flex-end; /* 内容靠底部对齐 */
}

.bid-amount-selector.locked {
  border-color: #D50000;
  background: rgba(213, 0, 0, 0.1);
}

.bid-amount-selector .label {
  color: #666; 
  font-size: 10px; 
  margin-bottom: 8px; /* 标签和按钮之间的间距 */
  font-family: 'Rajdhani', sans-serif; 
  flex-shrink: 0; /* 标签不收缩 */
}

.bid-buttons-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  width: 100%;
  /* 移除 flex 相关属性，grid 不需要 */
}

.bid-amount-btn {
  background: #222;
  border: 1px solid #444;
  color: #FFD700;
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: bold;
  padding: 6px 4px;
  cursor: pointer;
  transition: all 0.2s;
  outline: none;
  min-height: 28px;
}

.bid-amount-btn:hover:not(:disabled) {
  background: #333;
  border-color: #FFD700;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
}

.bid-amount-btn.active {
  background: #FFD700;
  color: #000;
  border-color: #FFD700;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
}

.bid-amount-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bid-amount-btn.locked-amount:not(:disabled) {
  background: #D50000;
  color: #fff;
  border-color: #D50000;
  opacity: 0.6;
  cursor: not-allowed;
}

.bid-amount-btn.locked-amount.active {
  background: #FF6B6B;
  color: #fff;
}

.bid-amount-btn.locked-amount:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: #333;
  border-color: #666;
  color: #666;
}

/* 单边模式下强制锁定的 10 按钮样式 */
.bid-amount-btn.forced-active {
  background: #D50000;
  color: #fff;
  border-color: #FFD700;
  cursor: not-allowed; /* 虽然是选中的，但不能取消，所以给个禁止手势 */
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); /* 金色光晕，表示强制锁定 */
  position: relative;
}

.bid-amount-btn.forced-active::after {
  content: '🔒';
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 10px;
  opacity: 0.8;
}

.bid-amount-btn.forced-active.active {
  background: #FF1744;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
}

.lock-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 12px;
  color: #D50000;
}

/* .label 样式已在 .bid-amount-selector .label 中定义 */

.btn-capture {
  flex: 1; /* 占据剩余空间 */
  min-width: 120px; /* 设置最小宽度，确保按钮不会太小 */
  background: #FFD700; 
  color: #000;
  border-bottom: 4px solid #F9A825;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%; /* 与档位选择器高度一致 */
}

.btn-capture:hover { 
  background: #FFEA00; 
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); 
}

.glitch-text { 
  font-size: 20px; 
  font-weight: 900; 
  letter-spacing: 2px; 
}

/* 3. 终止按钮 (红色, 与休息按钮样式一致) */
.btn-terminate {
  flex: 0 0 100px;
  width: 100px; /* 明确设置宽度，避免在 column 布局中被拉伸 */
  height: 90px; /* 明确设置高度，与休息按钮一致 */
  background: #D50000; 
  border-bottom: 4px solid #B71C1C;
  display: flex; 
  flex-direction: column; 
  justify-content: center; 
  align-items: center;
  color: #fff;
}

.btn-terminate:hover { 
  background: #FF1744; 
  box-shadow: 0 0 15px rgba(213, 0, 0, 0.4); 
}

.btn-terminate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #333;
  color: #666;
  border-color: #666;
}

.main-text { 
  font-size: 16px; 
  font-weight: bold; 
}

.sub-text { 
  font-size: 12px; 
  opacity: 0.8; 
  margin-top: 2px; 
}

/* 提示文字 */
.waiting-text, .spectator-text {
  text-align: center; 
  color: #666; 
  font-family: 'Rajdhani', sans-serif; 
  letter-spacing: 2px; 
  padding: 20px;
}

/* 等待阶段操作区域 */
.waiting-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  width: 100%;
}

.waiting-actions .waiting-text {
  margin-bottom: 0;
}

/* 【已删除】攻略准备阶段相关样式已移除 */

/* 单边模式提示 */
.single-mode-notice {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(213, 0, 0, 0.2);
  border: 1px solid #D50000;
  color: #FF6B6B;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 12px;
  white-space: nowrap;
  animation: fadeInUp 0.3s ease-out;
  z-index: 100;
  border-radius: 4px;
}

.single-mode-notice .notice-icon {
  font-size: 14px;
}

.single-mode-notice .notice-text {
  font-weight: 600;
  letter-spacing: 1px;
}

/* 选择提示字幕 */
.choice-hint {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 15px;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #00E5FF;
  color: #00E5FF;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 14px;
  white-space: nowrap;
  animation: fadeInUp 0.3s ease-out;
  z-index: 1000;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 终止状态样式 */
.terminated-status {
  width: 100%;
  text-align: center;
  color: #D50000;
  font-size: 24px;
  font-weight: 900;
  border: 2px solid #D50000;
  padding: 20px;
  background: rgba(0, 0, 0, 0.8);
  letter-spacing: 4px;
  animation: pulse 2s infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.terminated-status .terminated-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 10px rgba(213, 0, 0, 0.5);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 20px rgba(213, 0, 0, 0.8);
  }
}
/* 暂停按钮 (橙色) */
.btn-pause {
  background: #FF9800; 
  color: #000;
  padding: 15px 40px; 
  font-size: 18px; 
  font-weight: 900;
  border-bottom: 4px solid #E65100;
  min-width: 160px; /* 确保宽度足够 */
}

.btn-pause:hover:not(:disabled) { 
  background: #FFB74D;
  box-shadow: 0 0 15px rgba(255, 152, 0, 0.4);
}

/* 继续按钮 (绿色呼吸灯) */
.btn-resume {
  background: #00C853; 
  color: #000;
  padding: 15px 40px; 
  font-size: 18px; 
  font-weight: 900;
  border-bottom: 4px solid #1B5E20;
  min-width: 160px;
  animation: pulse-green 2s infinite;
}

.btn-resume:hover:not(:disabled) { 
  background: #69F0AE;
  box-shadow: 0 0 15px rgba(0, 200, 83, 0.4);
}

@keyframes pulse-green {
  0% { box-shadow: 0 0 0 0 rgba(0, 200, 83, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(0, 200, 83, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 200, 83, 0); }
}
</style>
