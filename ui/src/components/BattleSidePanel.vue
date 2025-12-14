<template>
  <div 
    class="battle-side-panel-container"
    :class="[
      sideClass,
      { 'flash-green': props.choiceComplete },
      { 'flash-red': props.terminatedInWaiting }
    ]"
  >
    <!-- 已部署列表（在面板外侧，保持不变） -->
    <div v-if="deployedOps.length > 0" class="deployed-list-container" :class="side">
      <div class="deployed-header">DEPLOYED</div>
      <div class="deployed-scroll">
        <div v-for="op in deployedOps" :key="op.name" class="deployed-item">
          <img :src="op.avatar" class="deployed-img" :alt="op.name">
          <div class="deployed-name">{{ op.name }}</div>
        </div>
      </div>
    </div>

    <!-- 新的垂直分层布局：多功能指挥侧栏 -->
    <div class="battle-side-panel">
      <!-- Header区域：队伍信息、资源仪表盘、队员列表、状态提示 -->
      <div class="panel-header">
        <!-- 队伍标识 -->
        <div class="team-identity">
          <div class="team-logo-box">
            <span class="placeholder-logo">{{ side === 'left' ? 'A' : 'B' }}</span>
          </div>
          <div class="team-info">
            <div class="team-label">小队 // SQUAD</div>
            <div class="team-name">{{ teamName }}</div>
          </div>
        </div>

        <!-- 资源仪表盘（增强版） -->
        <div class="resource-dashboard">
          <!-- 调用点 -->
          <div class="res-row cp-row">
            <div class="res-icon-box">
              <img src="/images/调用点.png" class="res-img" alt="CP" @error="handleImageError">
            </div>
            <div class="res-data">
              <div class="res-label">调用点</div>
              <!-- 【信息隔断】选手视角下，隐藏对手的 CP 数值和进度条 -->
              <div v-if="currentCp === -1" class="res-value cp-value">???</div>
              <div v-else class="res-value cp-value">{{ displayCP }}</div>
              <!-- 进度条 -->
              <div v-if="currentCp === -1" class="res-progress-bar">
                <div class="res-progress-fill cp-progress" style="width: 0%"></div>
              </div>
              <div v-else class="res-progress-bar">
                <div class="res-progress-fill cp-progress" :style="{ width: `${Math.min((displayCP / 100) * 100, 100)}%` }"></div>
              </div>
            </div>
            <div class="floating-container" ref="cpFloatRef"></div>
          </div>

          <!-- 情报点 -->
          <div class="res-row ip-row">
            <div class="res-icon-box">
              <img src="/images/情报点.png" class="res-img" alt="IP" @error="handleImageError">
            </div>
            <div class="res-data">
              <div class="res-label">情报点</div>
              <!-- 【信息隔断】选手视角下，隐藏对手的 IP 数值和进度条 -->
              <div v-if="currentIp === -1" class="res-value ip-value">???</div>
              <div v-else class="res-value ip-value">{{ displayIP }}</div>
              <!-- 进度条 -->
              <div v-if="currentIp === -1" class="res-progress-bar">
                <div class="res-progress-fill ip-progress" style="width: 0%"></div>
              </div>
              <div v-else class="res-progress-bar">
                <div class="res-progress-fill ip-progress" :style="{ width: `${Math.min((displayIP / 10) * 100, 100)}%` }"></div>
              </div>
            </div>
            <div class="floating-container" ref="ipFloatRef"></div>
          </div>
        </div>

        <!-- 队员信息栏 -->
        <div class="members-bar" v-if="players.length > 0">
          <div class="members-label">成员:</div>
          <div class="members-list">
            <div 
              v-for="(player, index) in players" 
              :key="index"
              class="member-item"
              :class="{ 'is-leader': index === 0 }"
            >
              <img 
                :src="player.avatar || '/default_avatar.png'" 
                class="member-avatar" 
                :alt="player.nickname"
                @error="handleImageError"
              >
              <div class="member-name">{{ player.nickname }}</div>
              <div v-if="index === 0" class="leader-badge">L</div>
            </div>
          </div>
        </div>

        <!-- 状态提示区域 -->
        <div class="status-indicator-area">
          <!-- 选择完成提示（绿色） -->
          <div v-if="props.choiceComplete" class="status-indicator status-complete">
            <div class="status-icon">✓</div>
            <div class="status-text">该队伍已完成本回合的选择！</div>
          </div>
          
          <!-- 终止提示（红色） -->
          <div v-if="props.terminatedInWaiting" class="status-indicator status-terminated">
            <div class="status-icon">✕</div>
            <div class="status-text">该队伍已选择终止本轮博弈！</div>
          </div>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="separator">
        <div class="line"></div>
        <div class="tag">干员列表 // ROSTER</div>
        <div class="line"></div>
      </div>

      <!-- 干员列表区域（常驻显示） -->
      <div class="roster-container">
        <div v-if="displayOperators.length === 0" class="empty-state">
          <div>AWAITING DEPLOYMENT</div>
          <div class="sub">暂无干员调入</div>
        </div>

        <div class="operator-list">
          <div 
            v-for="(op, index) in displayOperators" 
            :key="index" 
            class="op-card"
            :class="[
              getOpRarityClass(op),
              { 'selectable': isStrategyMode && isMyStrategyTurn }
            ]"
            @click="handleOpClick(op)"
            @contextmenu.prevent="handleOpRightClick(op, $event)"
          >
            <div class="op-media">
              <!-- 判断是否显示职业图标：
                   1. 博弈干员 + 未完全揭露（isFullyRevealed === false）：显示职业图标
                   2. 开局第3个干员 + 选手视角：显示职业图标
                   3. 其他情况：显示头像 -->
              <template v-if="(op.isBiddingBlindBox && !op.isFullyRevealed) || (op.isThirdOperator && props.role === 'PLAYER')">
                <!-- 显示职业图标 -->
                <img 
                  :src="getProfessionIconPath(op.profession)" 
                  class="op-icon" 
                  :alt="getClassCn(op.profession)"
                  @error="(e) => { console.error('[BattleSidePanel] 职业图标加载失败:', { profession: op.profession, src: e.target.src }) }"
                >
              </template>
              <template v-else>
                <!-- 其他情况：显示头像 -->
                <img :src="op.avatar" class="op-avatar" :alt="op.name" @error="handleImageError">
              </template>
            </div>

            <div class="op-details">
              <div class="op-name">
                <!-- 判断显示的名字：
                     1. 博弈干员 + 未完全揭露（isFullyRevealed === false）：显示"未知+职业"
                     2. 开局第3个干员 + 选手视角：显示"未知+职业"
                     3. 其他情况：显示真实名字 -->
                <template v-if="(op.isBiddingBlindBox && !op.isFullyRevealed) || (op.isThirdOperator && props.role === 'PLAYER')">
                  {{ `未知${getClassCn(op.profession)}` }}
                </template>
                <template v-else>
                  {{ op.name }}
                </template>
              </div>
              <div class="op-sub">
                <!-- 判断显示的分支：
                     1. 博弈干员：根据 isSubclassRevealed 判断（解锁后显示分支，未解锁显示"职业-???"）
                     2. 开局第3个干员 + 选手视角：显示"职业-???" -->
                <template v-if="op.isBiddingBlindBox && !op.isSubclassRevealed">
                  {{ getClassCn(op.profession) }}-???
                </template>
                <template v-else-if="op.isThirdOperator && props.role === 'PLAYER'">
                  {{ getClassCn(op.profession) }}-???
                </template>
                <template v-else>
                  {{ getClassCn(op.profession) }}-{{ op.subClass }}
                </template>
              </div>
            </div>

            <div class="op-stats">
              <div class="op-stars" v-if="op.isStarRevealed || op.isFullyRevealed || (!op.isBiddingBlindBox && !op.isThirdOperator)">
                <!-- 判断显示的星级：
                     1. 博弈干员：根据 isStarRevealed 判断（解锁后显示星级，未解锁显示"???"）
                     2. 开局第3个干员 + 选手视角：显示"???" -->
                <template v-if="op.isBiddingBlindBox && !op.isStarRevealed">
                  <span class="stars-unknown">???</span>
                </template>
                <template v-else-if="op.isThirdOperator && props.role === 'PLAYER'">
                  <span class="stars-unknown">???</span>
                </template>
                <template v-else>
                  <span class="stars-text">{{ "★".repeat(op.rarity) }}</span>
                </template>
              </div>
              <div class="op-stars unknown" v-else>???</div>
              <div class="op-cost">{{ op.cost }} <span class="unit">CP</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer区域：状态指示器 -->
      <div class="panel-footer">
        <div class="status-indicator">
          <div class="indicator-light" :class="{ 'active': choiceComplete }"></div>
          <div class="indicator-text">
            {{ choiceComplete ? 'READY' : 'PLANNING...' }}
          </div>
        </div>
        <div v-if="terminatedInWaiting" class="terminate-tag">TERMINATED</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  side: {
    type: String,
    required: true, // 'left' or 'right'
    validator: (value) => ['left', 'right'].includes(value)
  },
  role: {
    type: String,
    default: 'SPECTATOR' // 'HOST' | 'PLAYER' | 'SPECTATOR'
  },
  teamName: {
    type: String,
    default: 'TEAM NAME'
  },
  players: {
    type: Array,
    default: () => []
  },
  operators: {
    type: Array,
    default: () => [] // 接收干员数据
  },
  // 接收真实的资源数值
  currentCp: {
    type: Number,
    default: 50
  },
  currentIp: {
    type: Number,
    default: 1
  },
  choiceComplete: {
    type: Boolean,
    default: false // 队伍是否完成选择（休息/博弈抓取）
  },
  terminatedInWaiting: {
    type: Boolean,
    default: false // 队伍是否在等待阶段选择终止
  },
  deployedOps: {
    type: Array,
    default: () => [] // 已部署的干员列表
  },
  isStrategyMode: {
    type: Boolean,
    default: false // 是否处于攻略准备阶段
  },
  strategyTurn: {
    type: String,
    default: null // 当前攻略回合：'A' 或 'B'
  },
  userTeam: {
    type: String,
    default: '' // 当前用户队伍：'A' 或 'B'
  }
});

const emit = defineEmits(['op-click']);

const sideClass = computed(() => `side-${props.side}`);

// 【新增】判断是否应该隐藏资源（选手视角下，隐藏对手的资源）
const shouldHideResources = computed(() => {
  if (props.role !== 'PLAYER') return false; // 主持人/观众可见
  // 如果我是A队且这是B队面板 -> 隐藏
  if (props.userTeam === 'A' && props.teamName === 'TEAM B') return true;
  // 如果我是B队且这是A队面板 -> 隐藏
  if (props.userTeam === 'B' && props.teamName === 'TEAM A') return true;
  return false;
});

// 【新增】过滤掉开局干员（避免在队伍信息栏中重复显示）
const displayOperators = computed(() => {
  return props.operators.filter(op => !op.isOpening)
})

// 判断是否是我的攻略回合
const isMyStrategyTurn = computed(() => {
  return props.isStrategyMode && props.strategyTurn === props.userTeam;
});

// 处理干员点击
const handleOpClick = (op) => {
  if (props.isStrategyMode && isMyStrategyTurn.value) {
    emit('op-click', op);
  }
};

// 处理干员右键点击（攻略准备阶段快速选择，不反转信息栏）
const handleOpRightClick = (op, event) => {
  // 阻止默认右键菜单
  event.preventDefault();
  // 阻止事件冒泡，避免触发 flip-card-inner 的点击事件（反转信息栏）
  event.stopPropagation();
  
  // 在攻略准备阶段且是我的回合时，执行快速选择
  if (props.isStrategyMode && isMyStrategyTurn.value) {
    emit('op-click', op);
  }
};

// --- 资源动画逻辑 ---

// 显示用的数值 (用于滚动动画)
// 【修复】处理 -1 的情况（迷雾状态）
const displayCP = ref(props.currentCp === -1 ? 0 : props.currentCp);
const displayIP = ref(props.currentIp === -1 ? 0 : props.currentIp);

// 飘字容器 ref
const cpFloatRef = ref(null);
const ipFloatRef = ref(null);

// 图片加载失败处理
const handleImageError = (event) => {
  // 如果图标不存在，使用占位符
  event.target.style.display = 'none';
};

// 数字滚动函数 (Tweening)
const tweenNumber = (targetVal, displayRef) => {
  const start = displayRef.value;
  const end = targetVal;
  if (start === end) return;
  
  const duration = 500; // 动画持续 0.5秒
  const startTime = performance.now();

  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // 缓动函数 (Ease Out)
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    // 更新显示数值 (取整)
    displayRef.value = Math.round(start + (end - start) * easeProgress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  requestAnimationFrame(animate);
};

// 创建飘字特效 (Floating Text)
const createFloatingText = (diff, containerRef) => {
  if (!containerRef) return;
  
  const el = document.createElement('div');
  el.className = diff > 0 ? 'float-text plus' : 'float-text minus';
  el.innerText = diff > 0 ? `+${diff}` : `${diff}`;
  
  // 挂载
  containerRef.appendChild(el);
  
  // 动画结束后移除 DOM
  setTimeout(() => {
    if (el.parentNode) {
      el.remove();
    }
  }, 1500);
};

// 监听 CP 变化
watch(() => props.currentCp, (newVal, oldVal) => {
  // 【修复】迷雾状态不显示飘字
  if (newVal === -1 || oldVal === -1) return
  const diff = newVal - oldVal;
  if (diff !== 0) {
    createFloatingText(diff, cpFloatRef.value); // 飘字
    tweenNumber(newVal, displayCP);             // 滚动
  }
});

// 监听 IP 变化
watch(() => props.currentIp, (newVal, oldVal) => {
  // 【修复】迷雾状态不显示飘字
  if (newVal === -1 || oldVal === -1) return
  const diff = newVal - oldVal;
  if (diff !== 0) {
    createFloatingText(diff, ipFloatRef.value);
    tweenNumber(newVal, displayIP);
  }
});

// --- 辅助函数 ---
// 模拟职业图标映射
const getClassIcon = (prof) => {
  const map = { 
    'SNIPER': '🏹', 
    'CASTER': '🔮', 
    'GUARD': '⚔️', 
    'MEDIC': '💊',
    'DEFENDER': '🛡️',
    'VANGUARD': '⚡',
    'SUPPORTER': '🎭',
    'SPECIALIST': '🗡️'
  };
  return map[prof] || '❓';
};

// 职业中文名
const getClassCn = (prof) => {
  const map = { 
    'SNIPER': '狙击', 
    'CASTER': '术师', 
    'GUARD': '近卫',
    'MEDIC': '医疗',
    'DEFENDER': '重装',
    'VANGUARD': '先锋',
    'SUPPORTER': '辅助',
    'SPECIALIST': '特种'
  };
  return map[prof] || '干员';
};

// 获取职业图标路径
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
  };
  return map[profession] || '/images/近卫.png';
};

// 为未知干员获取职业图标路径（从 displayName 中提取职业信息）
const getProfessionIconPathForUnknown = (op) => {
  // 优先使用 profession 字段（英文）
  if (op.profession) {
    return getProfessionIconPath(op.profession);
  }
  
  // 如果 profession 不存在，从 displayName 中提取职业
  if (op.displayName && op.displayName.includes('未知')) {
    const professionCn = op.displayName.replace('未知', ''); // 提取"未知"后面的职业名
    const professionMap = {
      '狙击': 'SNIPER',
      '术师': 'CASTER',
      '近卫': 'GUARD',
      '重装': 'DEFENDER',
      '医疗': 'MEDIC',
      '先锋': 'VANGUARD',
      '辅助': 'SUPPORTER',
      '特种': 'SPECIALIST'
    };
    const professionEn = professionMap[professionCn] || 'GUARD';
    return getProfessionIconPath(professionEn);
  }
  
  // 最后尝试使用 professionCn
  if (op.professionCn) {
    const professionMap = {
      '狙击': 'SNIPER',
      '术师': 'CASTER',
      '近卫': 'GUARD',
      '重装': 'DEFENDER',
      '医疗': 'MEDIC',
      '先锋': 'VANGUARD',
      '辅助': 'SUPPORTER',
      '特种': 'SPECIALIST'
    };
    const professionEn = professionMap[op.professionCn] || 'GUARD';
    return getProfessionIconPath(professionEn);
  }
  
  // 默认返回近卫图标
  return '/images/近卫.png';
};

// 稀有度样式
const getOpRarityClass = (op) => {
  // 如果连星级都不知道，显示灰色
  if (!op.isRevealed && !op.isStarRevealed) return 'rarity-unknown';
  return `rarity-${op.rarity}`;
};
</script>

<style scoped>
/* =========================================
   容器：定位
   ========================================= */
.battle-side-panel-container {
  position: absolute;
  top: 50%; /* 居中定位 */
  width: 400px; /* 280px * 1.6 = 448px */
  height: calc((100vh - 80px) * 0.85); /* 高度缩小为0.85倍 */
  z-index: 100 !important;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  /* transform 在 .side-left 和 .side-right 中设置 */
}

.side-left {
  left: 0; /* 贴近左边缘 */
  transform: translateY(-50%) rotateY(15deg); /* 垂直居中 + 向内折叠15度 */
  transform-origin: left center;
}

.side-right {
  right: 0; /* 贴近右边缘 */
  transform: translateY(-50%) rotateY(-15deg); /* 垂直居中 + 向内折叠15度 */
  transform-origin: right center;
}

/* 悬停效果：A队蓝色光晕（向内）+ 折叠角度变为10度 */
.side-left:hover {
  transform: translateY(-50%) rotateY(10deg); /* 保持垂直居中 */
  box-shadow: 
    inset 4px 0 20px rgba(0, 174, 239, 0.6),
    inset 8px 0 40px rgba(0, 174, 239, 0.4),
    inset 12px 0 60px rgba(0, 174, 239, 0.2);
}

/* 悬停效果：B队红色光晕（向内）+ 折叠角度变为10度 */
.side-right:hover {
  transform: translateY(-50%) rotateY(-10deg); /* 保持垂直居中 */
  box-shadow: 
    inset -4px 0 20px rgba(213, 0, 0, 0.6),
    inset -8px 0 40px rgba(213, 0, 0, 0.4),
    inset -12px 0 60px rgba(213, 0, 0, 0.2);
}

/* =========================================
   新的多功能指挥侧栏
   ========================================= */
.battle-side-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 15, 20, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  transition: all 0.3s;
  box-sizing: border-box;
}

/* 侧边定位和裁剪 */
.side-left .battle-side-panel {
  border-left: 4px solid #00AEEF;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%);
}

.side-right .battle-side-panel {
  border-right: 4px solid #D50000;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 20px 100%, 0 calc(100% - 20px));
}

/* =========================================
   Header区域：队伍信息、资源仪表盘、队员列表、状态提示
   ========================================= */
.panel-header {
  padding: 15px;
  background: rgba(0, 0, 0, 0.3);
}

/* 队伍标识 */
.team-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.team-logo-box {
  width: 32px;
  height: 32px;
  background: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #555;
  flex-shrink: 0;
}

.placeholder-logo {
  font-weight: bold;
  font-size: 20px;
  color: #666;
}

.team-info {
  flex: 1;
}

.team-label {
  font-size: 10px;
  color: #666;
  letter-spacing: 2px;
  font-family: 'Rajdhani', sans-serif;
}

.team-name {
  font-size: 20px;
  font-weight: 900;
  color: #fff;
  font-family: 'Noto Sans SC', sans-serif;
  line-height: 1;
  text-transform: uppercase;
}

/* 资源仪表盘（增强版） */
.resource-dashboard {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.res-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  position: relative;
  transition: background 0.2s;
}

.res-row:hover {
  background: rgba(255, 255, 255, 0.08);
}

.res-icon-box {
  flex-shrink: 0;
}

.res-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  opacity: 0.8;
}

.res-data {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.res-label {
  font-size: 10px;
  color: #888;
  font-family: 'Rajdhani', sans-serif;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.res-value {
  font-size: 24px;
  font-weight: bold;
  font-family: 'Rajdhani', sans-serif;
  line-height: 1;
}

.cp-value {
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

.ip-value {
  color: #00E5FF;
  text-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
}

/* 进度条 */
.res-progress-bar {
  width: 100%;
  height: 3px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 2px;
  position: relative;
}

.res-progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s cubic-bezier(0.4, 0.0, 0.2, 1); /* 更平滑的动画，确保减少时也能动态运动 */
  position: relative;
}

.cp-progress {
  background: linear-gradient(90deg, #FFD700, #FFA500);
  box-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
}

.ip-progress {
  background: linear-gradient(90deg, #00E5FF, #0099CC);
  box-shadow: 0 0 4px rgba(0, 229, 255, 0.5);
}

/* 队员信息栏 */
.members-bar {
  margin-top: 8px;
  margin-bottom: 4px; /* 减少底部间距 */
  font-size: 10px;
  color: #666;
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-family: 'Rajdhani', sans-serif;
}

.members-label {
  letter-spacing: 1px;
  flex-shrink: 0;
  padding-top: 2px;
}

.members-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  position: relative;
  min-width: 0;
}

.member-avatar {
  width: 65px;
  height: 65px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  object-fit: cover;
  background: rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.member-item.is-leader .member-avatar {
  border-color: #FFD700;
  box-shadow: 0 0 4px rgba(255, 215, 0, 0.3);
}

.member-name {
  color: #aaa;
  font-weight: 500;
  font-size: 20px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50px;
  line-height: 1.2;
}

.leader-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 12px;
  height: 12px;
  background: #FFD700;
  color: #000;
  border-radius: 50%;
  font-size: 8px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
}

/* =========================================
   分隔线
   ========================================= */
.separator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 15px;
  margin: 4px 0; /* 减少上下间距，从10px改为4px */
}

.separator .line {
  flex: 1;
  height: 1px;
  background: #444;
}

.separator .tag {
  font-size: 10px;
  color: #666;
  font-family: 'Rajdhani', sans-serif;
  letter-spacing: 1px;
  white-space: nowrap;
}

/* =========================================
   飘字特效
   ========================================= */
.floating-container {
  position: absolute;
  right: 0;
  top: 0;
  width: 0;
  height: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 100;
}

.float-text {
  position: absolute;
  left: 50%;
  top: -10px;
  transform: translateX(-50%);
  font-family: 'Rajdhani', sans-serif;
  font-weight: 900;
  font-size: 16px;
  white-space: nowrap;
  animation: floatUp 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

.float-text.plus {
  color: #00C853; /* 加分绿色 */
}

.float-text.minus {
  color: #D50000; /* 减分红色 */
}

@keyframes floatUp {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(0) scale(0.5);
  }
  20% {
    opacity: 1;
    transform: translateX(-50%) translateY(-15px) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-40px) scale(1);
  }
}

/* =========================================
   干员列表区域（常驻显示）
   ========================================= */
.roster-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 10px 10px 10px;
  min-height: 0; /* 允许flex收缩 */
}

.roster-container::-webkit-scrollbar {
  width: 4px;
}

.roster-container::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 2px;
}

.roster-container::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.empty-state {
  text-align: center;
  color: #444;
  margin-top: 50px;
  font-family: 'Rajdhani', sans-serif;
}

.empty-state .sub {
  font-size: 10px;
  margin-top: 5px;
  color: #666;
}

.operator-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 干员卡片 */
.op-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #1a1a1a;
  border: 1px solid #333;
  padding: 6px;
  transition: all 0.2s;
  position: relative;
}

/* 选中态/交互态 */
.op-card.selectable {
  cursor: pointer;
}

.op-card.selectable:hover {
  border-color: #fff;
  background: #2a2a2a;
  transform: scale(1.02);
}

/* 稀有度边框 */
.rarity-6 { border-left: 3px solid #FF7F27; }
.rarity-5 { border-left: 3px solid #FFD700; }
.rarity-4 { border-left: 3px solid #A020F0; }
.rarity-3 { border-left: 3px solid #00AEEF; }
.rarity-unknown { border-left: 3px solid #666; }

/* 干员媒体（头像/图标） */
.op-media {
  width: 40px;
  height: 40px;
  background: #000;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.op-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.op-icon {
  width: 80%;
  height: 80%;
  object-fit: contain;
  opacity: 0.7;
}

/* 干员详情 */
.op-details {
  flex: 1;
  min-width: 0;
}

.op-name {
  font-size: 13px;
  font-weight: bold;
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.op-sub {
  font-size: 10px;
  color: #777;
}

/* 干员统计 */
.op-stats {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.op-stars {
  font-size: 10px;
  color: #FFD700;
  letter-spacing: -1px;
}

.op-stars.unknown {
  color: #444;
  letter-spacing: 0;
}

.stars-text {
  color: #FFD700;
}

.stars-unknown {
  color: #444;
  letter-spacing: 0;
}

.op-cost {
  font-size: 14px;
  font-weight: bold;
  color: #00AEEF;
  font-family: 'Rajdhani', sans-serif;
}

.op-cost .unit {
  font-size: 8px;
  color: #555;
  margin-left: 1px;
}

/* 队伍信息栏闪烁效果 */
.battle-side-panel-container.flash-green {
  animation: flashGreen 0.5s ease-in-out 2;
}

.battle-side-panel-container.flash-red {
  animation: flashRed 0.5s ease-in-out 2;
}

@keyframes flashGreen {
  0%, 100% {
    box-shadow: 0 0 0 rgba(0, 255, 0, 0);
  }
  50% {
    box-shadow: 0 0 30px rgba(0, 255, 0, 0.8), 0 0 60px rgba(0, 255, 0, 0.4);
  }
}

@keyframes flashRed {
  0%, 100% {
    box-shadow: 0 0 0 rgba(255, 0, 0, 0);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 0, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.4);
  }
}

/* 状态提示区域（在Header中） */
.status-indicator-area {
  width: 100%;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  position: relative;
}

/* 状态提示指示器（Header中的） */
.status-indicator-area .status-indicator {
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid;
  padding: 8px 12px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Noto Sans SC', sans-serif;
  animation: fadeInOut 3s ease-in-out;
}

.status-indicator-area .status-indicator.status-complete {
  border-color: #32FF64;
  color: #32FF64;
}

.status-indicator-area .status-indicator.status-terminated {
  border-color: #D50000;
  color: #D50000;
}

.status-indicator-area .status-icon {
  font-size: 20px;
  font-weight: bold;
  flex-shrink: 0;
}

.status-indicator-area .status-text {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translateY(-5px);
  }
  10% {
    opacity: 1;
    transform: translateY(0);
  }
  90% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-5px);
  }
}

/* =========================================
   Footer区域：状态指示器
   ========================================= */
.panel-footer {
  padding: 10px 15px;
  border-top: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.indicator-light {
  width: 6px;
  height: 6px;
  background: #444;
  border-radius: 50%;
  transition: all 0.3s;
}

.indicator-light.active {
  background: #32FF64;
  box-shadow: 0 0 5px #32FF64;
}

.indicator-text {
  font-size: 10px;
  color: #666;
  font-family: 'Rajdhani', sans-serif;
  letter-spacing: 0.5px;
}

.terminate-tag {
  font-size: 10px;
  color: #D50000;
  font-weight: bold;
  border: 1px solid #D50000;
  padding: 1px 4px;
  border-radius: 2px;
  font-family: 'Rajdhani', sans-serif;
}

/* =========================================
   已部署列表样式
   ========================================= */

.deployed-list-container {
  position: absolute;
  top: 0;
  width: 80px;
  height: 100%; /* 与主面板等高 */
  background: rgba(20, 20, 20, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  padding: 5px;
  transition: all 0.5s;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  z-index: 10;
}

/* A队(left panel) -> 列表在右侧 */
.deployed-list-container.left {
  right: -90px; /* 移到面板外面 */
  border-left: 2px solid #00AEEF; /* 蓝色装饰 */
  background: linear-gradient(90deg, rgba(0, 174, 239, 0.1), transparent);
  transform: rotateY(15deg); /* 跟随容器的折叠角度（15度） */
  transform-origin: left center;
}

/* B队(right panel) -> 列表在左侧 */
.deployed-list-container.right {
  left: -90px;
  border-right: 2px solid #D50000; /* 红色装饰 */
  background: linear-gradient(-90deg, rgba(213, 0, 0, 0.1), transparent);
  transform: rotateY(-15deg); /* 跟随容器的折叠角度（15度） */
  transform-origin: right center;
}

/* 悬停时，已部署列表也跟随容器角度变化 */
.side-left:hover .deployed-list-container.left {
  transform: rotateY(10deg);
}

.side-right:hover .deployed-list-container.right {
  transform: rotateY(-10deg);
}

.deployed-header {
  font-size: 10px;
  text-align: center;
  color: #888;
  margin-bottom: 5px;
  font-weight: bold;
  font-family: 'Rajdhani', sans-serif;
}

.deployed-scroll {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.deployed-scroll::-webkit-scrollbar {
  display: none;
}

.deployed-item {
  width: 100%;
  aspect-ratio: 1;
  position: relative;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.5);
}

.deployed-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.5);
}

.deployed-name {
  position: absolute;
  bottom: 0;
  width: 100%;
  background: rgba(0, 0, 0, 0.7);
  font-size: 8px;
  color: #fff;
  text-align: center;
  padding: 2px;
  font-family: 'Noto Sans SC', sans-serif;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
