<template>
  <div class="battle-center-console">
    <!-- 统一进度条（显示在所有需要倒计时的阶段） -->
    <Transition name="fade">
      <div v-if="showProgressBar" class="progress-container" :class="{ 'paused': props.isPaused }">
        <div class="progress-label">
          <span>{{ getPhaseLabel }}</span> <span class="timer-value">{{ formatTime(displayTimeLeft) }}s</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :class="progressColorClass" :style="{ width: `${displayProgress}%` }"></div>
        </div>
      </div>
    </Transition>

    <!-- 开局展示阶段 -->
    <div v-if="matchPhase === 'OPENING_SHOW'" class="opening-scene">

      <!-- 干员卡片展示 -->
      <div v-if="showResult" class="opening-cards-row" :class="{ 'flying-away': isFlying }">
        <div 
          v-for="(op, index) in openingOperators" 
          :key="index"
          class="opening-card"
          :class="`delay-${index}`"
        >
          <!-- 前两个干员：所有人显示完整信息 -->
          <template v-if="index < 2">
            <div class="card-inner revealed">
              <img :src="op.avatar" class="op-avatar" :alt="op.name || '干员'" @error="handleImageError">
              <div class="op-meta">
                <div class="op-name-text">{{ op.name || '未知干员' }}</div>
                <div class="op-stars">{{ '★'.repeat(op.rarity || 0) }}</div>
              </div>
            </div>
          </template>
          <!-- 第3个干员：选手显示职业图标+未知信息，主持人/观众显示头像+完整信息 -->
          <template v-else-if="index === 2">
            <div class="card-inner" :class="shouldHideInfo(index) ? 'mystery' : 'revealed'">
              <!-- 选手视角：显示职业图标 -->
              <img v-if="shouldHideInfo(index)" :src="getProfessionIconPath(op.profession)" class="op-avatar profession-icon" :alt="getClassCn(op.profession)">
              <!-- 主持人/观众视角：显示头像 -->
              <img v-else :src="op.avatar" class="op-avatar" :alt="op.name" @error="handleImageError">
              <div class="op-meta">
                <!-- 选手视角：只显示"未知+职业" -->
                <template v-if="shouldHideInfo(index)">
                  <div class="op-name-text">未知{{ getClassCn(op.profession) }}</div>
                  <div class="op-sub-text">UNKNOWN</div>
                </template>
                <!-- 主持人/观众视角：显示完整信息 -->
                <template v-else>
                  <div class="op-name-text">{{ op.name }}</div>
                  <div class="op-stars">{{ '★'.repeat(op.rarity || 0) }}</div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 抽取中文字（已移至全局drawing-layer） -->
    </div>

    <!-- 【已删除】博弈结束等待阶段和攻略准备阶段UI已移除 -->

    <!-- 博弈动画阶段（带折叠动画） -->
    <div v-else-if="matchPhase === 'BIDDING_ANIMATION' && animStage === 'BROADCAST'" class="anim-scene">
      <Transition name="banner-fold">
        <div v-if="showBanner" class="tactical-banner active">
          <div class="shine-effect"></div>
          <div class="hazard-stripes"></div>
          
          <div class="banner-content">
            <div class="banner-sub-top">WARNING // COMBAT PROTOCOL INITIATED</div>
            <div class="banner-main-text">
              <span class="round-num">ROUND {{ currentRound }}</span>
              <span class="divider">//</span>
              <span class="action-text">START</span>
            </div>
            <div class="banner-sub-bottom">请双方做好博弈准备</div>
          </div>
          
          <div class="bracket bracket-left"></div>
          <div class="bracket bracket-right"></div>
        </div>
      </Transition>
    </div>

    <!-- 博弈阶段 -->
    <!-- 【修复】保持卡片可见：在播放动画时也保持 bidding-scene 显示 -->
    <div v-else-if="matchPhase === 'BIDDING' || (flyDirection && flyDirection !== '')" class="bidding-scene">

      <!-- 【修复问题2和3】当有飞行动画时，隐藏卡片，让动画显示 -->
      <div 
        v-if="!flyDirection"
        class="operator-card"
        :class="{
          'interactive': canBuyIntel && !isPaused // 【修复】暂停时移除交互样式
        }"
        @click="!isPaused && handleBuyIntel()"
        @mouseenter="isHoveringCard = true"
        @mouseleave="isHoveringCard = false"
      >
        <template v-if="shouldShowMystery">
          <div class="mystery-content">
            <img :src="getProfessionIconPath(biddingOperator?.profession)" class="big-class-icon">
            <div class="mystery-name">未知{{ getClassCn(biddingOperator?.profession) }}</div>
            <!-- 鼠标悬浮时显示情报点使用选项 -->
            <div v-if="canBuyIntel && isHoveringCard" class="buy-hint hover-hint">
              <img src="/images/购买情报.png" class="hint-icon" alt="购买情报">
              <div>点击解锁情报 (-1 IP)</div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="revealed-content">
            <!-- 选手和观众视角：显示职业图标（不显示干员头像） -->
            <img v-if="role === 'PLAYER' || role === 'SPECTATOR'" :src="getProfessionIconPath(biddingOperator?.profession)" class="big-class-icon">
            <!-- 主持人视角：显示干员头像 -->
            <img v-else :src="biddingOperator?.avatar" class="portrait">
            
            <div class="info-box">
              <!-- 选手和观众视角：显示"未知+职业"（不显示名字） -->
              <div class="name" v-if="role === 'PLAYER' || role === 'SPECTATOR'">{{ `未知${getClassCn(biddingOperator?.profession)}` }}</div>
              <!-- 主持人视角：显示干员名字 -->
              <div class="name" v-else>{{ biddingOperator?.name }}</div>
              
              <!-- 星级：选手和观众视角需要解锁后才显示，主持人始终显示 -->
              <div class="stars" v-if="role === 'PLAYER' || role === 'SPECTATOR'">
                <template v-if="intelUnlocked">
                  {{ '★'.repeat(biddingOperator?.rarity || 0) }}
                </template>
                <template v-else>
                  ???
                </template>
              </div>
              <div class="stars" v-else>
                {{ '★'.repeat(biddingOperator?.rarity || 0) }}
              </div>
              
              <!-- 分支：选手和观众视角需要解锁后才显示，主持人始终显示 -->
              <div class="sub" v-if="role === 'PLAYER' || role === 'SPECTATOR'">
                <template v-if="intelUnlocked">
                  {{ `${getClassCn(biddingOperator?.profession)}-${biddingOperator?.subClass}` }}
                </template>
                <template v-else>
                  {{ `${getClassCn(biddingOperator?.profession)}-???` }}
                </template>
              </div>
              <div class="sub" v-else>
                {{ `${getClassCn(biddingOperator?.profession)}-${biddingOperator?.subClass}` }}
              </div>
            </div>
            
            <div v-if="intelUnlocked" class="intel-badge">INTEL UNLOCKED</div>
            
            <!-- 鼠标悬浮时显示情报点使用选项（仅选手视角且未解锁时） -->
            <div v-if="canBuyIntel && isHoveringCard && !intelUnlocked" class="buy-hint hover-hint">
              <img src="/images/购买情报.png" class="hint-icon" alt="购买情报">
              <div>点击解锁情报 (-1 IP)</div>
            </div>
          </div>
        </template>
      </div>
      
      <div v-if="showBanToast" class="ban-toast">⛔ 该干员及同分支已被禁用</div>
    </div>

    <!-- 正常比赛界面 -->
    <div v-else class="battle-interface">
      <slot name="game-interface"></slot>
    </div>

    <!-- 开局机密终端特效（带CRT开关机动画） -->
    <Transition name="crt">
      <div v-if="showBlackOverlay" class="terminal-layer">
        <div class="terminal-grid"></div>
        <div class="terminal-container">
          <div class="terminal-header">
            <span class="status-dot"></span> SYSTEM_ACCESS // ROOT
          </div>
          <div class="terminal-body">
            <div class="decode-text">
              {{ decodedText }}<span class="cursor">_</span>
            </div>
          </div>
          <div class="terminal-footer">
            [ CONNECTIONS: SECURE ] [ DATA: ENCRYPTED ]
          </div>
        </div>
      </div>
    </Transition>

    <!-- 抽取中数据流特效（带淡入淡出动画） -->
    <Transition name="fade">
      <div v-if="showDrawingEffect" class="drawing-layer">
        <div class="data-stream-bg">
          <div 
            v-for="i in 10" 
            :key="i" 
            class="stream-column" 
            :style="{ animationDelay: `${Math.random() * -2}s`, left: `${(i-1)*10}%` }"
          >
            {{ generateRandomDataString() }}
          </div>
        </div>
        
        <div class="drawing-content">
          <div class="radar-circle"></div>
          <div class="glitch-text" data-text="正在检索数据库，抽取中...">
            正在检索数据库，抽取中...
          </div>
          <div class="drawing-sub">TARGET LOCKING // <span class="percent-counter">{{ randomPercent }}%</span></div>
        </div>
      </div>
    </Transition>

    <!-- 获胜飞出动画（数据捕获/量子传输） -->
    <!-- 【修复问题3】确保动画在 BIDDING 或 RESULT_SHOW 阶段都能显示 -->
    <div v-if="(matchPhase === 'BIDDING' || matchPhase === 'RESULT_SHOW') && flyDirection && flyDirection !== 'shatter' && flyDirection !== 'return'" class="fly-animation-layer">
      <div class="transmission-card" :class="flyDirection">
        <div class="trail-ghost ghost-1"></div>
        <div class="trail-ghost ghost-2"></div>
        <div class="card-core">
          <div class="card-face">
            <!-- 【飞行动画迷雾规则】根据视角和获胜方决定显示内容 -->
            <template v-if="shouldShowFullInfoInFlyAnimation">
              <!-- 主持人和获胜方：显示完整头像 -->
              <img v-if="biddingOperator && biddingOperator.avatar" :src="biddingOperator.avatar" class="op-avatar" />
            </template>
            <template v-else>
              <!-- 未获胜方：根据迷雾规则显示职业图标或部分信息 -->
              <template v-if="shouldShowMystery">
                <!-- 完全未知：只显示职业图标 -->
                <img v-if="biddingOperator && biddingOperator.profession" :src="getProfessionIconPath(biddingOperator.profession)" class="fly-icon" />
              </template>
              <template v-else>
                <!-- 部分解锁：显示职业图标（可选：也可以显示头像但模糊） -->
                <img v-if="biddingOperator && biddingOperator.profession" :src="getProfessionIconPath(biddingOperator.profession)" class="fly-icon" />
              </template>
            </template>
            <div class="scan-line"></div>
          </div>
        </div>
        <div class="speed-lines"></div>
      </div>
    </div>

    <!-- 平局破碎动画（强制熔断/协议清除） -->
    <!-- 【修复问题3】确保动画在 BIDDING 或 RESULT_SHOW 阶段都能显示 -->
    <div v-if="(matchPhase === 'BIDDING' || matchPhase === 'RESULT_SHOW') && flyDirection === 'shatter'" class="shatter-layer">
      <div class="meltdown-container">
        <div class="stamp-mark">OUT</div>
        
        <div class="shards-wrapper">
          <div class="shard s1" :style="getShardStyle()"></div>
          <div class="shard s2" :style="getShardStyle()"></div>
          <div class="shard s3" :style="getShardStyle()"></div>
          <div class="shard s4" :style="getShardStyle()"></div>
          <div class="shard s5" :style="getShardStyle()"></div>
        </div>
        
        <div class="explosion-wave"></div>
      </div>
    </div>

    <!-- 干员返回池子动画（数据回收） -->
    <!-- 【修复问题3】确保动画在 BIDDING 或 RESULT_SHOW 阶段都能显示 -->
    <div v-if="(matchPhase === 'BIDDING' || matchPhase === 'RESULT_SHOW') && flyDirection === 'return'" class="recall-layer">
      <div class="recall-container">
        <div class="upload-stream"></div>
        <div class="recall-card">
          <div class="recall-scan-beam"></div>
          <img v-if="biddingOperator && biddingOperator.avatar" :src="biddingOperator.avatar" class="op-avatar-recall" />
        </div>
        <div class="recall-text">RELEASING LINK...</div>
      </div>
    </div>

    <!-- 系统挂起等待阶段（战术休眠） -->
    <Transition name="standby-fade">
      <div v-if="matchPhase === 'WAITING' && isMatchEnded && showStandby" class="standby-layer">
        <div class="standby-overlay"></div>
        <div class="standby-content">
          <div class="standby-icon">⚠</div>
          <div class="standby-title">本轮博弈已结束</div>
          <div class="standby-sub">SYSTEM SUSPENDED // AWAITING HOST INSTRUCTION</div>
          <div class="standby-loader">
            <div class="standby-bar"></div>
          </div>
        </div>
        <div class="standby-scanline"></div>
      </div>
    </Transition>

    <!-- 结果展示面板（10秒） -->
    <!-- 【修复】延迟显示全息面板，等待飞行动画完成 -->
    <Transition name="hologram">
      <div v-if="matchPhase === 'RESULT_SHOW' && !flyDirection" class="result-board-container">
        <div v-if="!resultData" class="loading-data">
          DATA SYNCING... <br>
          <span style="font-size:10px; opacity:0.5">{{ resultData === null ? 'NULL' : 'EMPTY' }}</span>
        </div>
        
        <template v-else>
          <div class="result-header">
            <span class="decor-line"></span>
            <span class="title-text">第{{ currentRound }}博弈回合信息汇总</span>
            <span class="decor-line"></span>
          </div>

          <div class="result-body">
            <div class="team-row team-a">
              <div class="team-tag">队伍A</div>
              <div class="action-text">{{ getTeamActionText('A') }}</div>
            </div>
            
            <div class="team-row team-b">
              <div class="team-tag">队伍B</div>
              <div class="action-text">{{ getTeamActionText('B') }}</div>
            </div>

            <div class="separator">---------------- 本回合角色获取情况 ----------------</div>

            <div class="outcome-row" :class="getOutcomeClass">
              {{ getOutcomeText() }}
            </div>
          </div>

          <div class="result-footer">
            <div class="loading-spinner-small"></div>
            <span>稍后将自动进行下一回合博弈，请各位做好准备...</span>
          </div>
        </template>
      </div>
    </Transition>

    <!-- 冷却阶段（5秒） -->
    <Transition name="fade">
      <div v-if="matchPhase === 'COOLDOWN'" class="cooldown-layer">
        <div class="pulse-ring"></div>
        <div class="cooldown-text">NEXT ROUND LOADING...</div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  role: {
    type: String,
    default: 'SPECTATOR' // 'HOST' | 'PLAYER' | 'SPECTATOR'
  },
  matchPhase: {
    type: String,
    default: 'IDLE' // 'IDLE' | 'OPENING_SHOW' | 'WAITING' | 'BIDDING_ANIMATION' | 'BIDDING'
  },
  openingOperators: {
    type: Array,
    default: () => [] // 开局的那3个干员
  },
  progressPercent: {
    type: Number,
    default: 100 // 倒计时进度 0-100
  },
  biddingOperator: {
    type: Object,
    default: null // 当前博弈的干员
  },
  biddingTimeLeft: {
    type: Number,
    default: 30 // 剩余时间（秒）
  },
  biddingProgress: {
    type: Number,
    default: 100 // 倒计时进度 0-100
  },
  intelUnlocked: {
    type: Boolean,
    default: false // 是否解锁了情报
  },
  currentIp: {
    type: Number,
    default: 0 // 当前情报点
  },
  flyDirection: {
    type: String,
    default: '' // 'left' | 'right' | 'shatter' | 'return'
  },
  currentRound: {
    type: Number,
    default: 1
  },
  isPaused: {
    type: Boolean,
    default: false
  },
  isMatchEnded: {
    type: Boolean,
    default: false // 比赛是否彻底结束，用于显示等待阶段动画
  },
  resultData: {
    type: Object,
    required: false,
    default: () => null // 确保默认值是 null
  },
  userTeam: {
    type: String,
    default: '' // 'A' | 'B' | ''
  }
})

const emit = defineEmits(['buy-intel'])

// 控制内部动画状态
const showBlackOverlay = ref(false) // 黑屏/终端
const showResult = ref(false) // 显示3张卡
const loadingText = ref('') // 加载文字
const isFlying = ref(false) // 飞走动画
const animStage = ref('') // BROADCAST -> EXTRACTING
const isShattered = ref(false)
const showBanToast = ref(false)
const isHoveringCard = ref(false) // 鼠标是否悬浮在卡片上

// 新增：终端解码特效
const decodedText = ref('')
let decodeInterval = null
const fullOpeningText = "正在建立神经连接... 检测到干员信号..."

// 新增：抽取中数据流特效
const showDrawingEffect = ref(false)
const randomPercent = ref(0)
let percentInterval = null

// 新增：博弈横幅
const showBanner = ref(false)

// 新增：系统挂起层显示控制（延迟显示，等待返回动画完成）
const showStandby = ref(false)
let standbyTimer = null // 用于存储延迟显示的定时器

// 终端解码动画
const startDecodeEffect = () => {
  decodedText.value = ''
  let iteration = 0
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  
  if (decodeInterval) clearInterval(decodeInterval)
  
  decodeInterval = setInterval(() => {
    decodedText.value = fullOpeningText
      .split('')
      .map((letter, index) => {
        if (index < iteration) {
          return fullOpeningText[index]
        }
        return characters[Math.floor(Math.random() * characters.length)]
      })
      .join('')
    
    if (iteration >= fullOpeningText.length) { 
      clearInterval(decodeInterval)
    }
    
    iteration += 1 / 3 // 控制解码速度
  }, 30)
}

// 生成随机数据字符串
const generateRandomDataString = () => {
  return Array(20).fill(0).map(() => Math.random().toString(36).substring(2, 8).toUpperCase()).join(' ')
}

// 抽取中数据流特效
const startDrawingEffect = () => {
  showDrawingEffect.value = true
  randomPercent.value = 0
  // 模拟百分比跳动
  if (percentInterval) clearInterval(percentInterval)
  percentInterval = setInterval(() => {
    const increment = Math.random() * 5
    randomPercent.value = Math.min(100, Math.floor(randomPercent.value + increment))
    if (randomPercent.value >= 100) {
      randomPercent.value = 100
    }
  }, 50)
}

const stopDrawingEffect = () => {
  showDrawingEffect.value = false
  randomPercent.value = 0
  if (percentInterval) clearInterval(percentInterval)
}

// 监听阶段变化
watch(() => props.matchPhase, (newVal, oldVal) => {
  // 博弈动画阶段
  if (newVal === 'BIDDING_ANIMATION') {
    animStage.value = 'BROADCAST'
    showBanner.value = true
    setTimeout(() => {
      showBanner.value = false // 触发 banner-fold leave 动画
      // 等待横幅消失动画(0.4s)差不多结束后，显示数据流
      setTimeout(() => {
        animStage.value = 'EXTRACTING'
        startDrawingEffect()
      }, 400)
    }, 1500)
  }
  
  if (newVal === 'BIDDING') {
    stopDrawingEffect() // 确保特效关闭
  }
})

// 监听等待阶段和返回动画状态
watch([() => props.matchPhase, () => props.isMatchEnded, () => props.flyDirection], ([phase, isEnded, flyDir], [oldPhase, oldIsEnded, oldFlyDir]) => {
  // 清除之前的定时器
  if (standbyTimer) {
    clearTimeout(standbyTimer)
    standbyTimer = null
  }
  
  // 如果进入等待阶段且比赛已结束
  if (phase === 'WAITING' && isEnded) {
    // 如果正在播放返回动画，延迟1.5s后显示standby层（等待返回动画完成）
    if (flyDir === 'return') {
      showStandby.value = false
      standbyTimer = setTimeout(() => {
        showStandby.value = true
        standbyTimer = null
      }, 1500) // 返回动画持续1.5s
    } else if (oldFlyDir === 'return' && !flyDir) {
      // 如果刚从'return'变为空（返回动画刚完成），立即显示
      showStandby.value = true
    } else if (!flyDir) {
      // 如果没有返回动画（正常情况），立即显示
      showStandby.value = true
    }
  } else {
    // 其他情况隐藏
    showStandby.value = false
  }
})

// 进度条颜色逻辑（开局阶段）
// 进度条颜色逻辑（统一用于所有阶段）
const progressColorClass = computed(() => {
  if (props.isPaused) return 'bar-gray' // 暂停时变灰
  const p = displayProgress.value
  if (p > 70) return 'bar-blue'
  if (p > 30) return 'bar-orange'
  return 'bar-red'
})

// 进度条颜色逻辑（博弈阶段）- 保留用于兼容
const biddingProgressColorClass = computed(() => {
  return progressColorClass.value
})

// 计算是否显示进度条
const showProgressBar = computed(() => {
  return props.matchPhase === 'OPENING_SHOW' || 
         props.matchPhase === 'BIDDING' || 
         props.matchPhase === 'RESULT_SHOW' || 
         props.matchPhase === 'COOLDOWN'
})

// 计算当前阶段的标签
const getPhaseLabel = computed(() => {
  if (props.matchPhase === 'OPENING_SHOW') return 'LINKING'
  if (props.matchPhase === 'BIDDING') return 'DECISION'
  if (props.matchPhase === 'RESULT_SHOW') {
    console.log('[BattleCenterConsole] RESULT_SHOW 阶段，resultData:', props.resultData)
    return 'ANALYZING'
  }
  if (props.matchPhase === 'COOLDOWN') return 'LOADING'
  return 'STANDBY'
})

// 计算当前阶段的剩余时间
const displayTimeLeft = computed(() => {
  if (props.matchPhase === 'OPENING_SHOW') {
    const totalSeconds = 10
    return (props.progressPercent / 100) * totalSeconds
  } else if (props.matchPhase === 'BIDDING') {
    return props.biddingTimeLeft
  } else if (props.matchPhase === 'RESULT_SHOW' || props.matchPhase === 'COOLDOWN') {
    return props.biddingTimeLeft // 复用 biddingTimeLeft 来显示结果展示和冷却阶段的剩余时间
  }
  return 0
})

// 计算当前阶段的进度百分比（重命名为 displayProgress 避免与 props 冲突）
const displayProgress = computed(() => {
  if (props.matchPhase === 'OPENING_SHOW') {
    return props.progressPercent
  } else if (props.matchPhase === 'BIDDING') {
    return props.biddingProgress
  } else if (props.matchPhase === 'RESULT_SHOW') {
    return props.biddingProgress // 复用 biddingProgress，服务器会发送 0-100 的进度
  } else if (props.matchPhase === 'COOLDOWN') {
    return props.biddingProgress // 复用 biddingProgress，服务器会发送 0-100 的进度
  }
  return 100
})

// 格式化时间显示
const formatTime = (seconds) => {
  return seconds.toFixed(2)
}

// 计算剩余时间（精确到小数点后两位）- 保留用于兼容
const remainingTimeText = computed(() => {
  return formatTime(displayTimeLeft.value) + 's'
})

// 计算是否显示神秘模式
const shouldShowMystery = computed(() => {
  if (props.role === 'HOST') return false // 只有主持人是上帝视角
  // 【修改】观众和选手一样：没解锁情报 && 没到揭晓时刻 -> 神秘模式
  return !props.intelUnlocked && props.flyDirection !== 'shatter'
})

// 【飞行动画迷雾规则】判断飞行动画中是否应该显示完整信息
const shouldShowFullInfoInFlyAnimation = computed(() => {
  // 主持人始终显示完整信息
  if (props.role === 'HOST') return true
  
  // 如果有 resultData，判断是否是获胜方
  if (props.resultData && props.resultData.winner) {
    const winner = props.resultData.winner
    // 如果是获胜方，显示完整信息
    if (props.userTeam === winner) return true
    // 如果是未获胜方，根据迷雾规则显示
    return false
  }
  
  // 如果没有 resultData，根据迷雾规则判断
  return !shouldShowMystery.value && props.intelUnlocked
})

const canBuyIntel = computed(() => {
  // 【修复】增加 !props.isPaused 判断，暂停期间禁止购买情报
  return props.role === 'PLAYER' && !props.intelUnlocked && props.currentIp >= 1 && props.matchPhase === 'BIDDING' && !props.isPaused
})

const handleBuyIntel = () => {
  if (canBuyIntel.value) {
    emit('buy-intel')
  }
}

// 判断是否隐藏信息 (选手和观众视角 + 第3张)
const shouldHideInfo = (index) => {
  // 选手和观众视角且是第3个干员（index === 2）时才隐藏
  if ((props.role === 'PLAYER' || props.role === 'SPECTATOR') && index === 2) return true
  return false
}

// 图片加载失败处理
const handleImageError = (event) => {
  console.warn('[BattleCenterConsole] 图片加载失败:', event.target.src)
  // 图片加载失败不影响显示逻辑，只是图片不显示
  // 但名字和星级信息应该正常显示
}

// 暴露给父组件调用的动画方法
const playOpeningSequence = () => {
  console.log('[BattleCenterConsole] playOpeningSequence 被调用')
  console.log('[BattleCenterConsole] openingOperators:', props.openingOperators)
  console.log('[BattleCenterConsole] 当前角色:', props.role)
  
  // 详细检查每个干员的数据
  props.openingOperators.forEach((op, index) => {
    console.log(`[BattleCenterConsole] 干员${index + 1}数据:`, {
      name: op.name,
      avatar: op.avatar,
      rarity: op.rarity,
      profession: op.profession,
      professionCn: op.professionCn,
      shouldHide: index === 2 && props.role === 'PLAYER'
    })
  })
  
  // 1. 显示终端解码特效
  showBlackOverlay.value = true
  startDecodeEffect()
  
  setTimeout(() => {
    // 2. 终端消失，显示抽取中数据流特效
    showBlackOverlay.value = false
    if (decodeInterval) clearInterval(decodeInterval)
    startDrawingEffect()
    
    setTimeout(() => {
      // 3. 显示结果 (3张卡)
      stopDrawingEffect()
      showResult.value = true
      console.log('[BattleCenterConsole] 显示干员卡片，干员数量:', props.openingOperators.length)
      console.log('[BattleCenterConsole] showResult:', showResult.value)
    }, 2000) // 抽取持续2秒
  }, 3500) // 终端持续时间：3.5秒
}

// 飞走动画（开局阶段用，CSS控制）
const playFlyAnimation = () => {
  isFlying.value = true
  setTimeout(() => {
    // 重置状态
    showResult.value = false
    isFlying.value = false
  }, 1000)
}

// 辅助函数
const getClassIcon = (profession) => {
  const map = {
    'SNIPER': '🏹',
    'CASTER': '🔮',
    'GUARD': '⚔️',
    'DEFENDER': '🛡️',
    'MEDIC': '💊',
    'VANGUARD': '⚡',
    'SUPPORTER': '🎭',
    'SPECIALIST': '🎯'
  }
  return map[profession] || '❓'
}

const getClassCn = (profession) => {
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
  return map[profession] || '干员'
}

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
  }
  return map[profession] || '/images/近卫.png'
}

// 获取碎片的背景图样式
const getShardStyle = () => {
  if (props.biddingOperator && props.biddingOperator.avatar) {
    return { backgroundImage: `url(${props.biddingOperator.avatar})` }
  }
  return { backgroundColor: '#333' } // 默认颜色
}

// 辅助：生成完整文本（用于自己/主持人/观众）
const generateFullText = (action, usedIntel) => {
  let text = ''
  if (usedIntel) text += '[已消耗情报点] '
  
  if (action.type === 'BID') {
    text += `博弈抓取 (消耗 ${action.bid} CP)`
  } else if (action.type === 'REST') {
    text += `休息 (回 5 CP${usedIntel ? '' : ' + 1 IP'})`
  } else if (action.type === 'TERMINATED') {
    text += `已终止`
  } else {
    text += `未操作`
  }
  return text
}

// 辅助：生成队伍操作文本
const getTeamActionText = (team) => {
  if (!props.resultData) {
    console.log('[Console] getTeamActionText: resultData is null for team', team)
    return 'WAITING DATA...'
  }
  // 打印一次日志 (用 console.count 避免刷屏)
  if (team === 'A') {
    console.log('[Console] ResultData received:', props.resultData)
  }
  const action = team === 'A' ? props.resultData.teamAAction : props.resultData.teamBAction
  if (!action) {
    console.log('[Console] getTeamActionText: action is null for team', team)
    return 'NO ACTION DATA'
  }
  
  // 获取情报点使用情况
  const usedIntel = team === 'A' ? props.resultData.teamAIntel : props.resultData.teamBIntel
  
  // =======================================================
  // 【新增】信息迷雾逻辑
  // =======================================================
  
  // 1. 主持人/观众：全知视角
  if (props.role === 'HOST' || props.role === 'SPECTATOR') {
    return generateFullText(action, usedIntel)
  }
  
  // 2. 选手视角：有限视角
  if (props.role === 'PLAYER') {
    const myTeam = props.userTeam
    const isMyTeamInfo = (team === myTeam)
    
    // 情况A：看自己队伍的信息 -> 全知
    if (isMyTeamInfo) {
      return generateFullText(action, usedIntel)
    }
    
    // 情况B：看对手队伍的信息 -> 需判断是否满足"败者特权"
    // 败者特权条件：我方BID，对方BID，且对方赢了（即我方输了）
    const myAction = myTeam === 'A' ? props.resultData.teamAAction : props.resultData.teamBAction
    const winner = props.resultData.winner
    const opponentTeam = myTeam === 'A' ? 'B' : 'A'
    
    // 只有当我是败者(winner是对方)，且我也参与了竞价(myAction.type === 'BID')
    // 此时我可以知道对方花了多少钱
    const canSeeOpponentBid = (winner === opponentTeam) && (myAction && myAction.type === 'BID')
    
    if (action.type === 'BID') {
      if (canSeeOpponentBid) {
        // 败者特权：可以看到对方花了多少钱，但看不到是否用了情报点
        return `博弈抓取 (消耗 ${action.bid} CP)`
      } else {
        // 其他情况（我赢了、我休息、我终止）：看不到对方具体数值
        return `暂且未知`
      }
    }
    
    // 如果对方休息
    if (action.type === 'REST') {
      // 【修复】休息时显示"暂且未知"，而不是具体行为
      return `暂且未知`
    }
    
    // 如果对方终止
    if (action.type === 'TERMINATED') {
      // 终止是公开行为，可以显示
      return `已终止`
    }
    
    return `暂且未知`
  }
  
  return 'UNKNOWN'
}

// 辅助：生成结果文本 (核心信息隔断逻辑)
const getOutcomeText = () => {
  const res = props.resultData
  if (!res || !res.operator) return ''
  
  // 1. 获取干员显示名 (基于视角)
  let opName = '未知干员'
  const realOp = res.operator
  
  // 逻辑：
  // - 主持人/观众/获胜方：全知
  // - 失败方且买过情报：半知（未知职业+星级+分支）
  // - 失败方没买情报：未知（未知职业）
  // - 平局熔断：全知 (因为要进禁用池)
  
  const isWinner = (props.userTeam === res.winner)
  const isObserver = (props.role === 'HOST' || props.role === 'SPECTATOR')
  const isMeltdown = (res.winner === 'DRAW' || res.winner === 'NONE') // 平局或双休
  
  // 判断当前用户是否买了情报
  const myTeamIntel = (props.userTeam === 'A' ? res.teamAIntel : res.teamBIntel)
  
  if (isWinner || isObserver || isMeltdown) {
    opName = realOp.name // 全知
  } else if (myTeamIntel) {
    // 半知：未知职业+星级+分支
    const professionCn = getClassCn(realOp.profession)
    const stars = '★'.repeat(realOp.rarity || 0)
    opName = `未知${professionCn} (${stars} ${professionCn}-${realOp.subClass})`
  } else {
    // 全盲：未知职业
    opName = `未知${getClassCn(realOp.profession)}`
  }
  
  // 2. 生成文案
  if (res.winner === 'A') return `本博弈回合干员"${opName}"被队伍A抓取`
  if (res.winner === 'B') return `本博弈回合干员"${opName}"被队伍B抓取`
  if (res.winner === 'DRAW') return `由于双方出价一致/均选择休息，本博弈回合干员"${realOp.name}"及其分支被完纳入全局禁用池！`
  if (res.winner === 'NONE') return `由于本回合双方均已进入终止状态，所以本回合干员已重返有效干员池！`
  
  return 'NO RESULT'
}

const getOutcomeClass = computed(() => {
  const w = props.resultData?.winner
  if (w === 'A') return 'text-blue'
  if (w === 'B') return 'text-red'
  return 'text-yellow'
})

// 破碎动画方法
const playShatterAnimation = () => {
  isShattered.value = true
  setTimeout(() => {
    showBanToast.value = true
  }, 500)
  
  // 重置
  setTimeout(() => {
    isShattered.value = false
    showBanToast.value = false
  }, 3500)
}

// 博弈序列动画（由父组件调用）
const playBiddingSequence = (round) => {
  animStage.value = 'BROADCAST'
  showBanner.value = true
  setTimeout(() => {
    showBanner.value = false // 触发 banner-fold leave 动画
    setTimeout(() => {
      animStage.value = 'EXTRACTING'
      startDrawingEffect()
    }, 400) // 等待横幅消失动画完成
  }, 1500)
}

// 清理定时器
onUnmounted(() => {
  if (decodeInterval) clearInterval(decodeInterval)
  if (percentInterval) clearInterval(percentInterval)
  if (standbyTimer) clearTimeout(standbyTimer)
})

// 回收动画 (CSS控制)
const playReturnAnimation = () => {}

defineExpose({ 
  playOpeningSequence, 
  playFlyAnimation, 
  playBiddingSequence, 
  playShatterAnimation, 
  playReturnAnimation 
})
</script>

<style scoped>
.battle-center-console {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 40; /* 降低层级，确保低于 SidePanel (100) */
  /* 默认不阻挡鼠标事件 */
  pointer-events: none;
}

/* 只有在开局展示阶段才接收事件 */
.battle-center-console.is-active {
  pointer-events: auto;
}

/* ============================
   开局展示专用样式
   ============================ */
.opening-scene {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200; /* 高于普通界面 */
  pointer-events: auto; /* 开局展示时允许交互 */
  /* 确保可见 */
  visibility: visible;
  opacity: 1;
}

/* 统一进度条容器 */
.progress-container {
  position: absolute;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  width: 500px;
  z-index: 100;
  display: flex;
  flex-direction: column; /* 确保垂直排列 */
  justify-content: center;
  height: auto !important; /* 允许高度自撑开 */
  padding: 10px; /* 增加内边距 */
}

.progress-container.paused {
  opacity: 0.6;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 8px; /* 增加文字和条之间的间距 */
  position: relative;
  z-index: 2; /* 确保文字在最上层 */
  font-family: 'Rajdhani', sans-serif;
  font-size: 14px;
  font-weight: bold;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 0 10px rgba(0, 200, 255, 0.5);
}

.timer-value {
  color: #00C8FF;
  font-family: 'Consolas', monospace;
}

.progress-track {
  width: 100%;
  height: 12px; /* 稍微加厚一点 */
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 1;
}

/* 进度条容器（保留用于兼容） */
.progress-bar-wrapper {
  position: absolute;
  top: 20%;
  width: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.countdown-time {
  font-size: 24px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  font-family: 'Arial', 'Microsoft YaHei', sans-serif;
  letter-spacing: 2px;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  position: relative;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: width 0.2s linear, background-color 0.3s; /* 稍微增加过渡时间，缓解抽搐 */
  border-radius: 4px;
}

.bar-blue {
  background: #00AEEF;
  box-shadow: 0 0 15px rgba(0, 174, 239, 0.8);
}

.bar-orange {
  background: #FFD700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
}

.bar-red {
  background: #D50000;
  box-shadow: 0 0 15px rgba(213, 0, 0, 0.8);
}

.bar-gray {
  background: #666;
  box-shadow: 0 0 10px rgba(100, 100, 100, 0.5);
}

/* 卡片行 */
.opening-cards-row {
  display: flex;
  gap: 40px;
  transform-style: preserve-3d;
  transition: all 0.8s cubic-bezier(0.6, -0.28, 0.735, 0.045);
}

/* 卡片单体 */
.opening-card {
  width: 160px;
  height: 200px;
  background: rgba(0, 0, 0, 0.85);
  border: 2px solid #333;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  animation: cardPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

/* 依次弹出 */
.delay-0 {
  animation-delay: 0.1s;
}

.delay-1 {
  animation-delay: 0.2s;
}

.delay-2 {
  animation-delay: 0.3s;
}

.card-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 15px;
  gap: 10px;
}

.op-avatar {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border: 2px solid #555;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
}

.op-avatar.profession-icon {
  object-fit: contain;
  padding: 10px;
  background: rgba(0, 174, 239, 0.1);
  border-color: #00AEEF;
}

.op-meta {
  margin-top: 5px;
  text-align: center;
}

.op-name-text {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 5px;
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
}

.op-stars {
  color: #FFD700;
  font-size: 14px;
  letter-spacing: -2px;
}

/* 未知样式 */
.mystery {
  color: #00AEEF;
  border: 2px dashed #00AEEF;
  background: rgba(0, 174, 239, 0.1);
}

.class-icon-big {
  font-size: 60px;
  margin-bottom: 15px;
  filter: drop-shadow(0 0 10px rgba(0, 174, 239, 0.6));
}

.op-sub-text {
  font-size: 12px;
  letter-spacing: 3px;
  color: rgba(0, 174, 239, 0.8);
  font-family: 'Arial', sans-serif;
}

/* =========================================
   Vue Transitions (进出场特效)
   ========================================= */

/* 1. CRT 开关机特效 (Terminal) */
.crt-enter-active { 
  animation: turn-on 0.4s ease-out; 
}

.crt-leave-active { 
  animation: turn-off 0.4s ease-in; 
}

@keyframes turn-on {
  0% { 
    transform: scale(1, 0.002) translate3d(0, 0, 0); 
    opacity: 0; 
    filter: brightness(3); 
  }
  50% { 
    transform: scale(1, 0.002) translate3d(0, 0, 0); 
    opacity: 1; 
  }
  100% { 
    transform: scale(1, 1) translate3d(0, 0, 0); 
    opacity: 1; 
    filter: brightness(1); 
  }
}

@keyframes turn-off {
  0% { 
    transform: scale(1, 1); 
    opacity: 1; 
    filter: brightness(1); 
  }
  50% { 
    transform: scale(1, 0.002); 
    opacity: 1; 
  }
  100% { 
    transform: scale(0, 0); 
    opacity: 0; 
    filter: brightness(0); 
  }
}

/* 2. 淡入淡出 (Data Stream / Progress) */
.fade-enter-active, .fade-leave-active { 
  transition: opacity 0.5s ease; 
}

.fade-enter-from, .fade-leave-to { 
  opacity: 0; 
}

/* 3. 横幅折叠特效 (Banner) - 增加淡入淡出效果 */
.banner-fold-enter-active { 
  animation: banner-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); 
}

.banner-fold-leave-active { 
  animation: banner-out 0.4s cubic-bezier(0.16, 1, 0.3, 1); 
}

@keyframes banner-in {
  0% { 
    transform: skewX(-20deg) scaleY(0); 
    opacity: 0; 
  }
  100% { 
    transform: skewX(-20deg) scaleY(1); 
    opacity: 1; 
  }
}

@keyframes banner-out {
  0% { 
    transform: skewX(-20deg) scaleY(1); 
    opacity: 1; 
  }
  100% { 
    transform: skewX(-20deg) scaleY(0); 
    opacity: 0; 
  }
}

/* =========================================
   1. 机密终端特效 (Opening) - 灰白色主题
   ========================================= */
.terminal-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.terminal-grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(200, 200, 200, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(200, 200, 200, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
  z-index: 0;
  opacity: 0.3;
}

.terminal-container {
  font-family: 'Consolas', 'Monaco', monospace;
  color: #d0d0d0; /* 灰白色 */
  width: 600px;
  background: rgba(20, 20, 20, 0.95);
  border: 1px solid #d0d0d0; /* 灰白色边框 */
  padding: 2px;
  box-shadow: 0 0 20px rgba(200, 200, 200, 0.2);
  transform: scale(1.2);
  position: relative;
  z-index: 1;
}

.terminal-header {
  background: #d0d0d0; /* 灰白色背景 */
  color: #000;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #000;
  border-radius: 50%;
  animation: blink-dot 1s infinite;
}

.terminal-body {
  padding: 40px 20px;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.decode-text {
  font-size: 24px;
  letter-spacing: 2px;
  text-shadow: 0 0 8px rgba(200, 200, 200, 0.8); /* 灰白色光晕 */
}

.cursor {
  display: inline-block;
  width: 12px;
  height: 24px;
  background: #d0d0d0; /* 灰白色光标 */
  margin-left: 4px;
  animation: blink-cursor 0.8s steps(2) infinite;
  vertical-align: bottom;
}

.terminal-footer {
  border-top: 1px solid #444444;
  padding: 4px 8px;
  font-size: 10px;
  color: #888888;
  display: flex;
  justify-content: space-between;
}

@keyframes blink-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* =========================================
   2. 数据流特效 (Drawing) - 已调整透明度
   ========================================= */
.drawing-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.data-stream-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: 0.05; /* 调整为20%不透明度 */
  z-index: 0;
}

.stream-column {
  position: absolute;
  top: -100%;
  width: 10%; /* 10列 */
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: #fff;
  word-break: break-all;
  text-align: center;
  animation: waterfall 4s linear infinite; /* 减缓50%：从2s变为4s */
  text-shadow: 0 0 5px #fff;
}

@keyframes waterfall {
  0% { transform: translateY(0); }
  100% { transform: translateY(200vh); }
}

.drawing-content {
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  position: relative;
}

.radar-circle {
  width: 120px;
  height: 120px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin-radar 1s linear infinite;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: -1;
}

@keyframes spin-radar { 
  to { transform: translate(-50%, -50%) rotate(360deg); } 
}

/* 核心故障文字 (50%透明度 + 白色-淡红色强光晕) */
.glitch-text {
  font-size: 48px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.5); /* 50% 不透明度 */
  position: relative;
  letter-spacing: 4px;
  /* 白色核心 + 淡红色外发光 */
  text-shadow: 
    0 0 5px rgba(255, 255, 255, 1),
    0 0 15px rgba(255, 200, 200, 0.8),
    0 0 30px rgba(255, 50, 50, 0.6);
  animation: glitch-skew 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite; /* 减缓70%：从0.3s变为1s */
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
}

.glitch-text::before, .glitch-text::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.8;
}

.glitch-text::before {
  color: rgba(255, 0, 234, 0.5); /* 调整伪元素透明度 */
  z-index: -1;
  animation: glitch-anim-1 6.67s infinite linear alternate-reverse; /* 减缓70%：从2s变为6.67s */
}

.glitch-text::after {
  color: rgba(0, 234, 255, 0.5); /* 调整伪元素透明度 */
  z-index: -2;
  animation: glitch-anim-2 6.67s infinite linear alternate-reverse; /* 减缓70%：从2s变为6.67s */
}

@keyframes glitch-skew {
  0% { transform: skew(0deg); }
  20% { transform: skew(-10deg); }
  40% { transform: skew(10deg); }
  60% { transform: skew(-5deg); }
  80% { transform: skew(5deg); }
  100% { transform: skew(0deg); }
}

@keyframes glitch-anim-1 {
  0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 2px); }
  20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -2px); }
  40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 2px); }
  60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); }
  80% { clip-path: inset(10% 0 70% 0); transform: translate(-2px, 2px); }
  100% { clip-path: inset(30% 0 20% 0); transform: translate(2px, -2px); }
}

@keyframes glitch-anim-2 {
  0% { clip-path: inset(10% 0 60% 0); transform: translate(2px, -2px); }
  20% { clip-path: inset(80% 0 5% 0); transform: translate(-2px, 2px); }
  40% { clip-path: inset(30% 0 20% 0); transform: translate(2px, -2px); }
  60% { clip-path: inset(10% 0 80% 0); transform: translate(-2px, 2px); }
  80% { clip-path: inset(50% 0 30% 0); transform: translate(2px, -2px); }
  100% { clip-path: inset(20% 0 70% 0); transform: translate(-2px, 2px); }
}

.drawing-sub {
  font-family: 'Rajdhani', sans-serif;
  color: #aaa;
  letter-spacing: 2px;
  font-size: 14px;
}

.percent-counter {
  color: #00eaff;
  font-weight: bold;
}

/* 飞走动画 */
.flying-away .opening-card:nth-child(1) {
  transform: translate(-600px, -200px) scale(0) rotate(-45deg);
  opacity: 0;
  transition: all 0.8s cubic-bezier(0.6, -0.28, 0.735, 0.045);
  transition-delay: 0s;
}

.flying-away .opening-card:nth-child(2) {
  transform: translate(0, -400px) scale(0) rotate(0deg);
  opacity: 0;
  transition: all 0.8s cubic-bezier(0.6, -0.28, 0.735, 0.045);
  transition-delay: 0.1s;
}

.flying-away .opening-card:nth-child(3) {
  transform: translate(600px, -200px) scale(0) rotate(45deg);
  opacity: 0;
  transition: all 0.8s cubic-bezier(0.6, -0.28, 0.735, 0.045);
  transition-delay: 0.2s;
}

/* 动画关键帧 */
@keyframes cardPop {
  from {
    transform: scale(0) translateY(50px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

/* 从右侧滑入，停留1.5秒，然后滑至左侧消失 */
@keyframes slideInOut {
  0% {
    transform: translateX(150%);
    opacity: 0;
  }
  15% {
    transform: translateX(0);
    opacity: 1;
  }
  57% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(-150%);
    opacity: 0;
  }
}

@keyframes glitch {
  0%, 100% {
    transform: translate(0);
    text-shadow: 0 0 20px rgba(0, 174, 239, 0.8);
  }
  25% {
    transform: translate(-1px, 1px);
    text-shadow: -2px 0 20px rgba(0, 174, 239, 0.8), 2px 0 20px rgba(255, 0, 0, 0.8);
  }
  50% {
    transform: translate(1px, -1px);
    text-shadow: 2px 0 20px rgba(0, 174, 239, 0.8), -2px 0 20px rgba(0, 255, 0, 0.8);
  }
  75% {
    transform: translate(-1px, -1px);
    text-shadow: -2px 0 20px rgba(0, 174, 239, 0.8), 2px 0 20px rgba(255, 255, 0, 0.8);
  }
}

.battle-interface {
  width: 100%;
  height: 100%;
  pointer-events: none; /* 正常界面不阻挡事件 */
}

/* =========================================
   等待阶段样式
   ========================================= */
.waiting-scene {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
}

.waiting-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.pulse-ring {
  width: 50px;
  height: 50px;
  border: 2px solid #00AEEF;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.pulse-ring.blue {
  border-color: #00AEEF;
}

.pulse-ring.red {
  border-color: #D50000;
}

.waiting-text {
  color: #666;
  font-family: 'Rajdhani', sans-serif;
  letter-spacing: 2px;
  font-size: 18px;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
}

/* =========================================
   博弈动画阶段样式
   ========================================= */
.anim-scene {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
}

/* =========================================
   3. 战术警报横幅 (Bidding Banner)
   ========================================= */
.tactical-banner {
  width: 100%;
  height: 180px;
  background: rgba(0, 0, 0, 0.9);
  border-top: 4px solid #FFCD00;
  border-bottom: 4px solid #FFCD00;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transform: skewX(-20deg) scaleX(0); /* 初始收缩 */
  transform-origin: center;
  opacity: 0;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease; /* 增加淡入淡出过渡时间 */
  overflow: hidden;
}

.tactical-banner.active {
  transform: skewX(-20deg) scaleX(1); /* 展开 */
  opacity: 1;
}

.hazard-stripes {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    rgba(255, 205, 0, 0.05),
    rgba(255, 205, 0, 0.05) 10px,
    transparent 10px,
    transparent 20px
  );
  z-index: 0;
  animation: stripes-move 20s linear infinite;
}

@keyframes stripes-move { 
  from { background-position: 0 0; } 
  to { background-position: 100px 0; } 
}

.shine-effect {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  transform: skewX(20deg);
  animation: shine-sweep 2s infinite;
  z-index: 1;
}

@keyframes shine-sweep {
  0% { left: -100%; }
  100% { left: 200%; }
}

.banner-content {
  transform: skewX(20deg); /* 纠正文字 */
  text-align: center;
  z-index: 2;
  color: #fff;
  position: relative;
}

.banner-main-text {
  font-size: 80px;
  font-weight: 900;
  font-family: 'Oswald', 'Microsoft YaHei', sans-serif;
  letter-spacing: 10px;
  line-height: 1;
  text-shadow: 0 0 20px rgba(255, 205, 0, 0.5);
  animation: tracking-contract 0.8s cubic-bezier(0.215, 0.610, 0.355, 1.000) both 0.2s;
}

@keyframes tracking-contract {
  0% { letter-spacing: 50px; opacity: 0; }
  100% { letter-spacing: 10px; opacity: 1; }
}

.round-num { color: #FFCD00; }
.divider { color: #555; margin: 0 20px; }
.banner-main-text .action-text { 
  color: #fff; 
  font-size: inherit; /* 继承父元素的80px字体大小 */
  font-weight: inherit; /* 继承父元素的900字重 */
}

.banner-sub-top, .banner-sub-bottom {
  font-size: 14px;
  letter-spacing: 4px;
  color: #888;
  font-family: 'Rajdhani', sans-serif;
  opacity: 0;
  animation: fade-in-text 0.5s ease forwards 0.6s;
}

.banner-sub-top {
  border-bottom: 1px solid #FFCD00;
  display: inline-block;
  padding: 0 20px 4px 20px;
  margin-bottom: 10px;
  color: #FFCD00;
}

@keyframes fade-in-text {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 装饰括号 */
.bracket {
  position: absolute;
  top: 50%;
  width: 20px;
  height: 80px;
  border: 4px solid #fff;
  transform: translateY(-50%) skewX(20deg);
  opacity: 0;
  animation: bracket-in 0.5s ease forwards 0.8s;
}

.bracket-left { 
  left: 10%; 
  border-right: none; 
}

.bracket-right { 
  right: 10%; 
  border-left: none; 
}

@keyframes bracket-in { 
  from { opacity: 0; transform: translateY(-50%) skewX(20deg) scaleY(2); } 
  to { opacity: 1; transform: translateY(-50%) skewX(20deg) scaleY(1); } 
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* =========================================
   博弈阶段样式
   ========================================= */
.bidding-scene {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto; /* 允许鼠标事件，以便购买情报 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 30px;
  z-index: 200;
}

/* 博弈阶段进度条已改用开局阶段的样式（.progress-bar-wrapper, .countdown-time, .progress-bar-container, .progress-fill） */

.operator-card {
  width: 200px;
  height: 280px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #444;
  border-radius: 8px;
  position: relative;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
  /* 淡入动画 */
  animation: cardPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.operator-card.interactive {
  cursor: pointer;
}

.operator-card.interactive:hover {
  border-color: #00E5FF;
  box-shadow: 0 0 20px rgba(0, 229, 255, 0.5);
}

.mystery-content,
.revealed-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.big-class-icon {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.portrait {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
}

.mystery-name {
  font-size: 18px;
  font-weight: bold;
  color: #00AEEF;
  text-align: center;
}

.info-box {
  text-align: center;
}

.name {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 5px;
}

.stars {
  color: #FFD700;
  font-size: 16px;
  margin-bottom: 5px;
}

.sub {
  font-size: 14px;
  color: #888;
}

.buy-hint {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  color: #00E5FF;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 8px;
  pointer-events: none; /* 不阻挡鼠标事件 */
}

/* 悬浮提示在显示时也不阻挡事件，但需要确保父元素可点击 */
.buy-hint.hover-hint {
  pointer-events: none;
}

.operator-card:hover .buy-hint.hover-hint {
  opacity: 1;
}

.hint-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.buy-hint.hover-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #00E5FF;
  padding: 15px 25px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 10;
  animation: fadeIn 0.2s ease-out;
  color: #00E5FF;
  font-size: 14px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.intel-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #00E5FF;
  color: #000;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
}

.ban-toast {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(213, 0, 0, 0.9);
  color: #fff;
  padding: 15px 30px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  animation: fadeInOut 3s;
}

/* 旧的飞行动画已删除，现在使用新的 transmission 和 meltdown 动画 */

@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  20%, 80% { opacity: 1; }
}

/* 博弈阶段干员卡片使用与开局阶段相同的 cardPop 弹出动画（已在上方定义） */

/* =========================================
   攻略准备阶段样式
   ========================================= */

/* 过渡特效场景 */
.transition-scene {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  overflow: hidden;
  /* 确保动画可以正常显示 */
  will-change: opacity;
}

.scan-grid {
  position: absolute;
  width: 200%;
  height: 200%;
  background: 
    linear-gradient(rgba(0, 174, 239, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 174, 239, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
  transform: perspective(500px) rotateX(60deg);
  animation: gridMove 20s linear infinite;
}

.system-alert {
  text-align: center;
  z-index: 2;
}

.alert-title {
  font-size: 40px;
  font-weight: 900;
  color: #fff;
  letter-spacing: 5px;
  text-shadow: 0 0 20px #00AEEF;
  font-family: 'Rajdhani', sans-serif;
}

.alert-sub {
  font-family: 'Rajdhani', sans-serif;
  color: #00AEEF;
  letter-spacing: 2px;
  margin-top: 10px;
  font-size: 18px;
}

.loading-bar {
  width: 300px;
  height: 4px;
  background: #333;
  margin: 20px auto;
  position: relative;
  overflow: hidden;
}

.loading-bar::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 0%;
  background: #00AEEF;
  animation: loadBar 4s linear forwards;
}

@keyframes gridMove {
  from {
    transform: perspective(500px) rotateX(60deg) translateY(0);
  }
  to {
    transform: perspective(500px) rotateX(60deg) translateY(40px);
  }
}

@keyframes loadBar {
  to {
    width: 100%;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* 过渡场景的淡入淡出 */
.transition-fade-enter-active {
  animation: fadeIn 0.5s ease-in;
}

.transition-fade-leave-active {
  animation: fadeOut 0.5s ease-out;
  }

.transition-fade-enter-from,
.transition-fade-leave-to {
  opacity: 0;
}

.transition-fade-enter-to,
.transition-fade-leave-from {
  opacity: 1;
}

/* 子元素的淡入淡出 */
.transition-fade-enter-active .scan-grid {
  animation: fadeIn 0.5s ease-in, gridMove 20s linear infinite;
  }

.transition-fade-leave-active .scan-grid {
  animation: fadeOut 0.5s ease-out, gridMove 20s linear infinite;
}

.transition-fade-enter-active .system-alert {
  animation: fadeIn 0.8s ease-in;
}

.transition-fade-leave-active .system-alert {
  animation: fadeOut 0.5s ease-out;
  }

.transition-fade-enter-active .alert-title {
  animation: fadeIn 1s ease-in;
}

.transition-fade-leave-active .alert-title {
  animation: fadeOut 0.5s ease-out;
}

.transition-fade-enter-active .alert-sub {
  animation: fadeIn 1.2s ease-in;
  }

.transition-fade-leave-active .alert-sub {
  animation: fadeOut 0.5s ease-out;
}

/* 【已删除】攻略准备阶段相关样式已全部移除 */

/* =========================================
   5. 获胜飞出动画 (Transmission) - 全新设计
   ========================================= */
/* 【修复】确保动画层在最上层 */
.fly-animation-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20000 !important; /* 比全息面板(9999)更高，确保动画在最上层 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.transmission-card {
  width: 140px;
  height: 180px;
  position: relative;
  animation-fill-mode: forwards;
  transform-style: preserve-3d;
}

/* 核心卡片 */
.card-core {
  width: 100%;
  height: 100%;
  background: #000;
  border: 2px solid #fff;
  overflow: hidden;
  position: relative;
  z-index: 2;
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
}

.fly-animation-layer .op-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 【飞行动画迷雾规则】职业图标样式 */
.fly-animation-layer .fly-icon {
  width: 80%;
  height: 80%;
  object-fit: contain;
  opacity: 0.7;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 扫描线效果 */
.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.8), transparent);
  transform: translateY(-100%);
  animation: scan-drop 0.5s linear infinite;
}

@keyframes scan-drop {
  100% { transform: translateY(100%); }
}

/* 拖尾幽灵 */
.trail-ghost {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.3);
  z-index: 1;
  filter: blur(4px);
}

.trail-ghost.ghost-1 {
  animation-delay: 0.1s;
}

.trail-ghost.ghost-2 {
  animation-delay: 0.2s;
}

/* --- A队获胜 (Left) --- */
.transmission-card.left {
  animation: transmit-left 0.8s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
}

.transmission-card.left .card-core {
  border-color: #00C8FF;
  box-shadow: 0 0 30px #00C8FF;
}

.transmission-card.left .trail-ghost {
  background: rgba(0, 200, 255, 0.4);
}

@keyframes transmit-left {
  0% {
    transform: scale(1) translateX(0) skewX(0);
    opacity: 1;
  }
  20% {
    transform: scale(1.1) translateX(20px) skewX(10deg);
    opacity: 1;
  }
  100% {
    transform: scale(0.2, 0.1) translateX(-1500px) skewX(-60deg);
    opacity: 0;
    filter: blur(10px);
  }
}

/* --- B队获胜 (Right) --- */
.transmission-card.right {
  animation: transmit-right 0.8s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
}

.transmission-card.right .card-core {
  border-color: #FF1744;
  box-shadow: 0 0 30px #FF1744;
}

.transmission-card.right .trail-ghost {
  background: rgba(255, 23, 68, 0.4);
}

@keyframes transmit-right {
  0% {
    transform: scale(1) translateX(0) skewX(0);
    opacity: 1;
  }
  20% {
    transform: scale(1.1) translateX(-20px) skewX(-10deg);
    opacity: 1;
  }
  100% {
    transform: scale(0.2, 0.1) translateX(1500px) skewX(60deg);
    opacity: 0;
    filter: blur(10px);
  }
}

/* =========================================
   6. 平局破碎动画 (Meltdown) - 全新设计
   ========================================= */
/* 【修复】确保动画层在最上层 */
.shatter-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20000 !important; /* 比全息面板(9999)更高，确保动画在最上层 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.meltdown-container {
  position: relative;
  width: 140px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 巨大印章 */
.stamp-mark {
  position: absolute;
  z-index: 20;
  font-size: 60px;
  font-weight: 900;
  color: #D50000;
  border: 8px solid #D50000;
  padding: 0 10px;
  transform: rotate(-15deg) scale(2);
  opacity: 0;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
  font-family: 'Black Ops One', 'Impact', 'Arial Black', sans-serif;
  animation: stamp-slam 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.4s forwards;
}

@keyframes stamp-slam {
  0% {
    transform: rotate(-15deg) scale(5);
    opacity: 0;
  }
  100% {
    transform: rotate(-15deg) scale(1);
    opacity: 1;
  }
}

/* 碎片容器 */
.shards-wrapper {
  width: 100%;
  height: 100%;
  position: absolute;
}

.shard {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  filter: grayscale(100%) contrast(1.5);
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8);
  /* 动画在具体碎片类中定义，避免重复播放 */
}

/* 利用 clip-path 切割碎片 */
.shard.s1 {
  clip-path: polygon(0 0, 60% 0, 30% 40%, 0 30%);
  animation: glitch-shake 0.4s linear, explode-1 0.8s ease-out 0.6s forwards;
}

.shard.s2 {
  clip-path: polygon(60% 0, 100% 0, 100% 40%, 70% 30%, 30% 40%);
  animation: glitch-shake 0.4s linear, explode-2 0.8s ease-out 0.6s forwards;
}

.shard.s3 {
  clip-path: polygon(0 30%, 30% 40%, 20% 80%, 0 100%);
  animation: glitch-shake 0.4s linear, explode-3 0.8s ease-out 0.6s forwards;
}

.shard.s4 {
  clip-path: polygon(30% 40%, 70% 30%, 80% 60%, 50% 100%, 20% 80%);
  animation: glitch-shake 0.4s linear, explode-4 0.8s ease-out 0.6s forwards;
}

.shard.s5 {
  clip-path: polygon(100% 40%, 100% 100%, 50% 100%, 80% 60%, 70% 30%);
  animation: glitch-shake 0.4s linear, explode-5 0.8s ease-out 0.6s forwards;
}

/* 故障抖动动画 */
@keyframes glitch-shake {
  0% { transform: translate(0); }
  20% { transform: translate(-5px, 5px); }
  40% { transform: translate(5px, -5px); }
  60% { transform: translate(-5px, -5px); }
  80% { transform: translate(5px, 5px); }
  100% { transform: translate(0); }
}

/* 碎片爆炸路径 */
@keyframes explode-1 {
  0% { transform: translate(0) rotate(0deg); }
  100% {
    transform: translate(-100px, -100px) rotate(-20deg);
    opacity: 0;
  }
}

@keyframes explode-2 {
  0% { transform: translate(0) rotate(0deg); }
  100% {
    transform: translate(100px, -80px) rotate(20deg);
    opacity: 0;
  }
}

@keyframes explode-3 {
  0% { transform: translate(0) rotate(0deg); }
  100% {
    transform: translate(-80px, 100px) rotate(-40deg);
    opacity: 0;
  }
}

@keyframes explode-4 {
  0% { transform: translate(0) rotate(0deg); }
  100% {
    transform: translate(0, 50px) scale(0.8);
    opacity: 0;
  }
}

@keyframes explode-5 {
  0% { transform: translate(0) rotate(0deg); }
  100% {
    transform: translate(100px, 100px) rotate(40deg);
    opacity: 0;
  }
}

/* 爆炸光波 */
.explosion-wave {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: shockwave 0.5s ease-out 0.6s forwards;
  z-index: 10;
  opacity: 0;
}

@keyframes shockwave {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(50);
    opacity: 0;
  }
}

/* =========================================
   7. 结果展示特效：数据回收 (Data Recall)
   ========================================= */
/* 【修复】确保动画层在最上层 */
.recall-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000 !important; /* 比全息面板(9999)更高，确保动画在最上层 */
  pointer-events: none;
}

.recall-container {
  position: relative;
  width: 140px;
  height: 180px;
  animation: float-up 1.5s ease-in forwards;
}

.recall-card {
  width: 100%;
  height: 100%;
  background: #000;
  border: 1px solid #00ffaa;
  box-shadow: 0 0 15px #00ffaa;
  position: relative;
  overflow: hidden;
  /* 数字化解体效果 */
  animation: digitize-dissolve 1.2s linear forwards 0.3s;
}

.op-avatar-recall {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(100%) sepia(100%) hue-rotate(100deg); /* 变成绿色调 */
  opacity: 0.8;
}

.recall-scan-beam {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 10px;
  background: #00ffaa;
  box-shadow: 0 0 20px #00ffaa;
  animation: scan-up 1.2s linear forwards 0.3s;
  z-index: 2;
}

.upload-stream {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 200%;
  background: repeating-linear-gradient(
    to top,
    transparent,
    transparent 10px,
    rgba(0, 255, 170, 0.2) 10px,
    rgba(0, 255, 170, 0.2) 20px
  );
  z-index: 1;
  opacity: 0;
  animation: stream-up 1s linear forwards 0.3s;
}

.recall-text {
  position: absolute;
  bottom: -40px;
  width: 100%;
  text-align: center;
  color: #00ffaa;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  text-shadow: 0 0 5px #00ffaa;
  animation: blink 0.5s infinite;
  z-index: 3;
}

@keyframes float-up {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-200px);
    opacity: 0;
  }
}

@keyframes scan-up {
  0% {
    bottom: 0;
  }
  100% {
    bottom: 100%;
  }
}

@keyframes digitize-dissolve {
  0% {
    clip-path: inset(0 0 0 0);
  }
  100% {
    clip-path: inset(0 0 100% 0);
  }
}

@keyframes stream-up {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-50%);
    opacity: 0;
  }
}

/* =========================================
   8. 全局等待状态 (System Suspend)
   ========================================= */
.standby-layer {
  position: absolute;
  inset: 0;
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.standby-overlay {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.1),
    rgba(0, 0, 0, 0.1) 1px,
    transparent 1px,
    transparent 2px
  );
  z-index: 0;
}

.standby-content {
  position: relative;
  z-index: 2;
  text-align: center;
  color: #d0d0d0; /* 灰白色 */
  border: 2px solid #d0d0d0;
  padding: 40px 80px;
  background: rgba(20, 20, 20, 0.9);
  box-shadow: 0 0 30px rgba(200, 200, 200, 0.2);
  /* 类似呼吸灯 */
  animation: standby-pulse 3s infinite ease-in-out;
}

.standby-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.standby-title {
  font-size: 36px;
  font-weight: 900;
  letter-spacing: 4px;
  font-family: 'Oswald', 'Impact', 'Arial Black', sans-serif;
  margin-bottom: 10px;
}

.standby-sub {
  font-size: 14px;
  letter-spacing: 2px;
  font-family: 'Rajdhani', sans-serif;
  opacity: 0.8;
}

.standby-loader {
  width: 100%;
  height: 4px;
  background: rgba(200, 200, 200, 0.2);
  margin-top: 30px;
  position: relative;
  overflow: hidden;
}

.standby-bar {
  width: 30%;
  height: 100%;
  background: #d0d0d0;
  position: absolute;
  left: -30%;
  animation: standby-scan 2s infinite ease-in-out;
}

.standby-scanline {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: rgba(200, 200, 200, 0.3);
  box-shadow: 0 0 10px rgba(200, 200, 200, 0.5);
  animation: scanline-move 5s linear infinite;
  z-index: 1;
  pointer-events: none;
}

/* 系统挂起层淡入淡出动画 */
.standby-fade-enter-active {
  transition: opacity 1s ease-in;
}

.standby-fade-leave-active {
  transition: opacity 0.5s ease-out;
}

.standby-fade-enter-from,
.standby-fade-leave-to {
  opacity: 0;
}

@keyframes standby-pulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(200, 200, 200, 0.1);
    border-color: rgba(200, 200, 200, 0.6);
  }
  50% {
    box-shadow: 0 0 40px rgba(200, 200, 200, 0.3);
    border-color: rgba(200, 200, 200, 1);
  }
}

@keyframes standby-scan {
  0% {
    left: -30%;
  }
  50% {
    left: 100%;
  }
  100% {
    left: 100%;
  }
}

@keyframes scanline-move {
  0% {
    top: 0%;
    opacity: 0;
  }
  10% {
    top: 10%;
    opacity: 1;
  }
  90% {
    top: 90%;
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}

/* =========================================
   9. 结果展示面板 (Result Show Panel)
   ========================================= */
/* 【修复】确保全息面板层级正确 */
.result-board-container {
  z-index: 9999 !important;
  position: absolute;
  top: 45%; /* 【整体下移】从 40% 改为 45%，与按钮区域一起下移 */
  left: 50%;
  transform: translate(-50%, -50%);
  width: 700px;
  max-width: 90vw;
  background: rgba(10, 15, 20, 0.95);
  border: 2px solid rgba(100, 100, 100, 0.5);
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.8), inset 0 0 30px rgba(0, 150, 255, 0.1);
  color: #fff;
  font-family: 'Consolas', 'Courier New', monospace;
  z-index: 9999 !important; /* 强制置顶 */
  visibility: visible !important;
  opacity: 1 !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.loading-data {
  padding: 40px;
  text-align: center;
  font-size: 18px;
  color: #00C8FF;
  letter-spacing: 2px;
}

.result-header {
  background: rgba(0, 0, 0, 0.6);
  padding: 15px 20px;
  text-align: center;
  font-size: 16px;
  letter-spacing: 3px;
  border-bottom: 1px solid rgba(100, 100, 100, 0.3);
  color: #aaa;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.decor-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(100, 100, 100, 0.5), transparent);
}

.title-text {
  font-weight: bold;
  color: #fff;
  white-space: nowrap;
}

.result-body {
  padding: 30px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.team-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-left: 3px solid transparent;
  transition: all 0.3s;
}

.team-a {
  border-left-color: #00C8FF;
}

.team-b {
  border-left-color: #FF1744;
}

.team-tag {
  font-weight: bold;
  font-size: 18px;
  letter-spacing: 2px;
}

.team-a .team-tag {
  color: #00C8FF;
}

.team-b .team-tag {
  color: #FF1744;
}

.action-text {
  font-size: 14px;
  color: #ccc;
  text-align: right;
}

.separator {
  text-align: center;
  color: #666;
  font-size: 12px;
  letter-spacing: 2px;
  padding: 10px 0;
  border-top: 1px solid rgba(100, 100, 100, 0.2);
  border-bottom: 1px solid rgba(100, 100, 100, 0.2);
}

.outcome-row {
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  padding: 20px;
  border: 2px dashed;
  background: rgba(0, 0, 0, 0.3);
  line-height: 1.6;
}

.text-blue {
  color: #00C8FF;
  border-color: #00C8FF;
  background: rgba(0, 200, 255, 0.1);
  box-shadow: 0 0 20px rgba(0, 200, 255, 0.2);
}

.text-red {
  color: #FF1744;
  border-color: #FF1744;
  background: rgba(255, 23, 68, 0.1);
  box-shadow: 0 0 20px rgba(255, 23, 68, 0.2);
}

.text-yellow {
  color: #FFD700;
  border-color: #FFD700;
  background: rgba(255, 215, 0, 0.1);
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.2);
}

.result-footer {
  background: rgba(0, 0, 0, 0.6);
  padding: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: #888;
  letter-spacing: 1px;
  border-top: 1px solid rgba(100, 100, 100, 0.3);
}

.loading-spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(100, 100, 100, 0.3);
  border-top-color: #00C8FF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 全息面板动画 */
.hologram-enter-active {
  animation: hologram-open 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.hologram-leave-active {
  animation: hologram-close 0.3s ease-out;
}

.hologram-enter-from,
.hologram-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scaleY(0);
}

@keyframes hologram-open {
  0% {
    transform: translate(-50%, -50%) scaleY(0);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) scaleY(1);
    opacity: 1;
  }
}

@keyframes hologram-close {
  0% {
    transform: translate(-50%, -50%) scaleY(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scaleY(0);
    opacity: 0;
  }
}

/* =========================================
   10. 冷却阶段 (Cooldown Phase)
   ========================================= */
.cooldown-layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  z-index: 200;
  backdrop-filter: blur(2px);
}

.pulse-ring {
  width: 200px;
  height: 200px;
  border: 3px solid rgba(0, 200, 255, 0.5);
  border-radius: 50%;
  position: absolute;
  animation: pulse-ring 2s ease-out infinite;
}

.pulse-ring::before {
  content: '';
  position: absolute;
  inset: -10px;
  border: 2px solid rgba(0, 200, 255, 0.3);
  border-radius: 50%;
  animation: pulse-ring 2s ease-out infinite 0.5s;
}

.cooldown-text {
  font-family: 'Rajdhani', sans-serif;
  font-size: 28px;
  font-weight: bold;
  letter-spacing: 6px;
  color: #00C8FF;
  text-shadow: 0 0 20px rgba(0, 200, 255, 0.8);
  animation: blink 1.5s infinite;
  position: relative;
  z-index: 1;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.8);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>

