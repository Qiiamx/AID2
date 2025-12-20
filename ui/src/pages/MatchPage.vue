<template>
  <div class="match-page">
    <!-- 【新增】数字比拼动画 -->
    <BattleNumberClash 
      :visible="showClashAnimation"
      :val-a="clashValA"
      :val-b="clashValB"
      @complete="handleClashComplete"
    />

    <!-- 【新增】动作气泡（主持人/观众视角） -->
    <BattleActionBubble 
      side="left"
      :visible="teamABubble.visible"
      :text="teamABubble.text"
    />

    <BattleActionBubble 
      side="right"
      :visible="teamBBubble.visible"
      :text="teamBBubble.text"
    />

    <!-- 左侧：队伍A -->
    <BattleSidePanel 
      side="left" 
      team-name="TEAM A" 
      :players="teamAList"
      :operators="teamAOperators"
      :current-cp="teamAResources.cp"
      :current-ip="(userRole === 'HOST' || userRole === 'SPECTATOR' || userTeam === 'A') ? teamAResources.ip : -1"
      :role="userRole"
      :user-team="userTeam"
      :choice-complete="teamAChoiceComplete"
      :terminated-in-waiting="teamATerminatedInWaiting"
    />
    
    <!-- 右侧：队伍B -->
    <BattleSidePanel 
      side="right" 
      team-name="TEAM B" 
      :players="teamBList"
      :operators="teamBOperators"
      :current-cp="teamBResources.cp"
      :current-ip="(userRole === 'HOST' || userRole === 'SPECTATOR' || userTeam === 'B') ? teamBResources.ip : -1"
      :role="userRole"
      :user-team="userTeam"
      :choice-complete="teamBChoiceComplete"
      :terminated-in-waiting="teamBTerminatedInWaiting"
    />
    
    <!-- 操作按钮区域（观众视角不显示） -->
    <BattleControlButtons 
      v-if="userRole !== 'SPECTATOR'"
      :role="userRole"
      :is-bidding="isBidding"
      :is-first-round="isFirstRound"
      :game-phase="gamePhase"
      :team="userTeam"
      :player-has-chosen="playerHasChosen"
      :player-choice-text="playerChoiceText"
      :is-terminated="isTerminated"
      :opponent-terminated="opponentTerminated"
      :is-match-ended="isMatchFullyEnded"
      :is-single-side-mode="isSingleSideMode"
      :is-paused="isPaused"
      @start-match="handleStartMatch"
      @start-bidding="handleStartBidding"
      @bid="handleBid"
      @select-amount="handleSelectAmount"
      @rest="handleRest"
      @terminate="handleTerminate"
      @restart-game="handleRestartGame"
      @restart-bidding="handleRestartBidding"
      @pause="handlePause"
      @resume="handleResume"
    />
    
    <!-- 种子控制台（仅主持人可见） -->
    <div v-if="userRole === 'HOST'" class="seed-console">
      <button class="seed-btn save" @click="generateGameSeed">
        <span class="text">获取本轮种子</span>
      </button>
      <button class="seed-btn load" @click="openLoadSeedModal">
        <span class="text">加载比赛种子</span>
      </button>
    </div>
    
    <!-- 种子弹窗 -->
    <div v-if="showSeedModal" class="confirm-modal-overlay" @click.self="showSeedModal = false">
      <div class="confirm-modal seed-modal-content">
        <div class="modal-header">{{ seedModalMode === 'SAVE' ? '当前比赛种子' : '加载比赛种子' }}</div>
        <div class="modal-content">
          <p v-if="seedModalMode === 'SAVE'" class="modal-tip">请复制下方代码并妥善保存：</p>
          <p v-else class="modal-tip">请粘贴种子代码以回溯比赛状态：</p>
          
          <textarea 
            v-model="seedText" 
            class="seed-textarea" 
            :readonly="seedModalMode === 'SAVE'"
            placeholder="在此处粘贴种子代码..."
          ></textarea>
        </div>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" @click="showSeedModal = false">关闭</button>
          <button 
            v-if="seedModalMode === 'SAVE'" 
            class="modal-btn modal-btn-confirm" 
            @click="copySeedToClipboard"
          >
            复制
          </button>
          <button 
            v-else 
            class="modal-btn modal-btn-confirm" 
            @click="executeLoadSeed"
          >
            确认加载
          </button>
        </div>
      </div>
    </div>
    
    <!-- 比赛内容区域（待后续开发） -->
    <div class="match-content">
      <!-- 这里将放置后续的比赛内容 -->
    </div>
    
    <!-- 核心区域：开局展示和博弈展示（放在最后，确保不影响其他元素） -->
    <BattleCenterConsole
      ref="centerConsoleRef"
      :role="userRole"
      :user-team="userTeam"
      :match-phase="gamePhase"
      :opening-operators="openingOperators"
      :progress-percent="openingProgress"
      :bidding-operator="currentBiddingOp"
      :bidding-time-left="biddingTimeLeft"
      :bidding-progress="biddingProgress"
      :intel-unlocked="intelUnlocked"
      :current-ip="userTeam === 'A' ? teamAResources.ip : (userTeam === 'B' ? teamBResources.ip : 0)"
      :fly-direction="flyAnimation"
      :current-round="currentRound"
      :is-paused="isPaused"
      :is-match-ended="isMatchFullyEnded"
      :result-data="resultData"
      @buy-intel="handleBuyIntel"
    />
    
    <!-- 禁用池组件（底层红色警告区域） -->
    <BattleBanPool :banned-map="bannedMap" />
    
    <!-- 左上角：阶段指示器 -->
    <BattlePhaseIndicator :phase="gamePhase" :round="currentRound" />
    
    <!-- 顶部中央：公共牌展示区 -->
    <BattlePublicPool 
      :opening-operators="openingOperators" 
      :game-phase="gamePhase"
      :user-role="userRole"
      :is-match-ended="isMatchFullyEnded"
    />
    
    <!-- 右上角：主持人信息 -->
    <BattleHostInfo 
      :host-info="hostInfo" 
      :is-host="userRole === 'HOST'"
      @show-invite="showInviteLinks = true"
    />
    
    <!-- 邀请链接弹窗（仅主持人可见） -->
    <Transition name="fade">
      <div v-if="showInviteLinks && userRole === 'HOST'" class="invite-links-modal" @click.self="showInviteLinks = false">
        <div class="invite-links-content">
          <div class="invite-links-header">
            <h3 class="modal-title">邀请链接 // INVITE LINKS</h3>
            <button @click="showInviteLinks = false" class="modal-close">✕</button>
          </div>
          <div class="invite-links-body">
            <div v-for="target in inviteTargets" :key="target.role" class="invite-link-item-modal">
              <div class="invite-link-label-modal" :style="{ color: target.color }">
                {{ target.label }}
              </div>
              <div class="invite-link-wrapper-modal">
                <span class="invite-link-text-modal">{{ getInviteLink(target.role) }}</span>
                <button 
                  @click="copyInviteLink(target.role)" 
                  class="invite-link-copy-btn-modal"
                >
                  {{ copiedLinkRole === target.role ? '已复制' : '复制' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- 右下角：战术记录 -->
    <BattleActionLog :logs="battleLogs" :user-role="userRole" :user-team="userTeam" />
    
    <!-- 左下角：观众列表 -->
    <BattleSpectatorList :spectators="spectatorsList" />
    
    <!-- 【已删除】二次确认弹窗（攻略准备阶段相关） -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useMatchStore } from '@/stores/match'
import BattleSidePanel from '@/components/BattleSidePanel.vue'
import BattleControlButtons from '@/components/BattleControlButtons.vue'
import BattleCenterConsole from '@/components/BattleCenterConsole.vue'
import BattleBanPool from '@/components/BattleBanPool.vue'
import BattleNumberClash from '@/components/BattleNumberClash.vue'
import BattleActionBubble from '@/components/BattleActionBubble.vue'
import BattlePhaseIndicator from '@/components/BattlePhaseIndicator.vue'
import BattleHostInfo from '@/components/BattleHostInfo.vue'
import BattlePublicPool from '@/components/BattlePublicPool.vue'
import BattleActionLog from '@/components/BattleActionLog.vue'
import BattleSpectatorList from '@/components/BattleSpectatorList.vue'
import { getProfessionEn, getOperatorsByBranch, getProfessionByBranch, getOperatorByName } from '@/utils/operators'

const route = useRoute()
const store = useMatchStore()

// 当前比赛阶段
const currentStage = ref('OPENING') // 'OPENING' | 'GAME_ROUND' | 'TERMINATED'
const currentRound = ref(1)

// 用户角色（从 store 或路由参数获取）
const userRole = computed(() => {
  // 优先从 store 获取
  if (store.myInfo.role === 'HOST') return 'HOST'
  if (store.myInfo.role === 'TEAM_A' || store.myInfo.role === 'TEAM_B') return 'PLAYER'
  if (store.myInfo.role === 'SPECTATOR') return 'SPECTATOR'
  
  // 备用：从路由参数获取
  const role = route.query.role
  if (role === 'HOST') return 'HOST'
  if (role === 'TEAM_A' || role === 'TEAM_B') return 'PLAYER'
  if (role === 'SPECTATOR') return 'SPECTATOR'
  
  return 'SPECTATOR' // 默认观众
})

// 用户队伍（用于区分队伍A和B的选手）
const userTeam = computed(() => {
  // 优先从 store 获取
  if (store.myInfo.role === 'TEAM_A') return 'A'
  if (store.myInfo.role === 'TEAM_B') return 'B'
  
  // 备用：从路由参数获取
  const role = route.query.role
  if (role === 'TEAM_A') return 'A'
  if (role === 'TEAM_B') return 'B'
  
  return '' // 非选手返回空
})

// 博弈状态
const isBidding = ref(false) // 是否正在博弈中（30秒倒计时中）
const isResolving = ref(false) // 是否正在结算
const isFirstRound = ref(true) // 是否是第一轮
const gamePhase = ref('OPENING') // 'OPENING' | 'OPENING_SHOW' | 'WAITING' | 'BIDDING_ANIMATION' | 'BIDDING' | 'TERMINATED' - 游戏阶段

// 博弈阶段相关数据
const currentBiddingOp = ref(null) // 当前博弈的干员
const biddingTimeLeft = ref(25) // 剩余时间（秒）
const biddingProgress = ref(100) // 倒计时进度 0-100
const biddingCountdownTimer = ref(null) // 博弈倒计时定时器
const intelUnlocked = ref(false) // 本地情报解锁状态（仅对当前用户有效）
const flyAnimation = ref('') // 卡片飞行动画方向：'left' | 'right' | 'shatter'
const isPaused = ref(false) // 【新增】是否已暂停
const resultData = ref(null) // 【新增】存储每回合的结算数据
// 【新增】记录本轮是否已使用情报（用于气泡文案）
const teamAUsedIntelCurrentRound = ref(false)
const teamBUsedIntelCurrentRound = ref(false)
const isTransitioning = ref(false) // 状态切换锁，防止动画期间被倒计时消息打断

// 【新增】数字比拼动画状态
const showClashAnimation = ref(false)
const clashValA = ref(0)
const clashValB = ref(0)
const pendingResultData = ref(null) // 暂存结果数据，等待比拼动画结束

// 【新增】动作气泡状态
const teamABubble = ref({ visible: false, text: '' })
const teamBBubble = ref({ visible: false, text: '' })

// 终止状态
const isTerminated = ref(false) // 本地是否已终止
const opponentTerminated = ref(false) // 对手是否已终止
const isMatchFullyEnded = ref(false) // 比赛是否完全结束（双方都终止）
const isSingleSideMode = ref(false) // 是否处于单边模式（真正的单边模式）

// 【已删除】攻略准备阶段相关状态已全部移除

// 队伍选择完成状态（用于显示闪烁效果）
const teamAChoiceComplete = ref(false) // A队是否完成选择（休息/博弈抓取）
const teamBChoiceComplete = ref(false) // B队是否完成选择（休息/博弈抓取）
const teamATerminatedInWaiting = ref(false) // A队是否在等待阶段选择终止
const teamBTerminatedInWaiting = ref(false) // B队是否在等待阶段选择终止

// 主持人追踪两队终止状态（用于生成种子）
const hostTeamAStatus = ref({ terminated: false })
const hostTeamBStatus = ref({ terminated: false })

// 种子功能相关
const showSeedModal = ref(false)
const seedModalMode = ref('SAVE') // 'SAVE' | 'LOAD'
const seedText = ref('')

// 禁用池与占用列表
const bannedMap = ref({}) // 禁用干员映射 { subClass: { professionCn: "职业", operators: [{ name, avatar }] } }
const bannedBranches = ref(new Set()) // 禁用的分支集合
const takenOperators = ref(new Set()) // 已被占用的干员集合

// 开局展示相关
const centerConsoleRef = ref(null) // BattleCenterConsole 组件引用
const openingOperators = ref([]) // 开局抽取的3名干员（由服务器提供）
const openingProgress = ref(100) // 倒计时进度 0-100（由服务器控制）
const openingCountdownTimer = ref(null) // 开局倒计时定时器（已废弃，由服务器控制）

// 主持人信息（从 store 中获取）
const hostInfo = computed(() => {
  const hosts = store.lobbyData.hosts || []
  if (hosts.length > 0) {
    return {
      nickname: hosts[0].nickname || 'UNKNOWN',
      avatar: hosts[0].avatar || ''
    }
  }
  return {
    nickname: 'UNKNOWN',
    avatar: ''
  }
})

// 队伍A列表（从 store 中获取）
const teamAList = computed(() => {
  return store.lobbyData.teamA || []
})

// 队伍B列表（从 store 中获取）
const teamBList = computed(() => {
  return store.lobbyData.teamB || []
})

// 队伍A干员列表（从 store 或 WebSocket 获取）
const teamAOperators = ref([])

// 队伍B干员列表（示例数据）
const teamBOperators = ref([])

// 观众列表（从 store 中获取）
const spectatorsList = computed(() => {
  return store.lobbyData.spectators || []
})

// 战术记录日志
const battleLogs = ref([])

// 邀请链接相关（仅主持人使用）
const showInviteLinks = ref(false)
const copiedLinkRole = ref('')
const roomInfo = ref({ keys: {} })

// 邀请目标列表
const inviteTargets = [
  { role: 'HOST', label: '主持人 // HOST', color: '#FFCD00' },
  { role: 'TEAM_A', label: '队伍A // TEAM A', color: '#00C8FF' },
  { role: 'TEAM_B', label: '队伍B // TEAM B', color: '#FF3333' },
  { role: 'SPECTATOR', label: '观众 // SPECTATOR', color: '#32FF64' }
]

// 从 localStorage 读取房间信息
const loadRoomInfo = () => {
  try {
    const saved = localStorage.getItem('roomInfo')
    if (saved) {
      roomInfo.value = JSON.parse(saved)
      console.log('[MatchPage] 已从 localStorage 加载房间信息:', roomInfo.value)
      
      // 验证数据完整性
      if (roomInfo.value && roomInfo.value.keys && 
          roomInfo.value.keys.HOST && 
          roomInfo.value.keys.TEAM_A && 
          roomInfo.value.keys.TEAM_B && 
          roomInfo.value.keys.SPECTATOR) {
        console.log('[MatchPage] 房间信息完整，所有 key 都存在')
        return
      } else {
        console.warn('[MatchPage] 房间信息不完整，尝试从路由参数补充')
      }
    }
    
    // 如果 localStorage 中没有数据或数据不完整，尝试从路由参数构建
    // 注意：这只能获取当前用户的 key，其他角色的 key 需要从 localStorage 获取
    const currentKey = route.query.key || store.credentials.key
    if (currentKey && userRole.value === 'HOST') {
      console.warn('[MatchPage] localStorage 中没有完整的房间信息，但检测到当前用户是主持人')
      console.warn('[MatchPage] 建议：请确保在创建房间后，房间信息已正确保存到 localStorage')
      
      // 尝试从 localStorage 读取部分数据，至少保留已有的 key
      if (!roomInfo.value || !roomInfo.value.keys) {
        roomInfo.value = { keys: {} }
      }
      
      // 如果当前 key 存在，至少可以显示当前角色的链接
      if (currentKey) {
        roomInfo.value.keys[userRole.value] = currentKey
        console.log(`[MatchPage] 已从路由参数设置 ${userRole.value} 的 key`)
      }
    }
  } catch (error) {
    console.error('[MatchPage] 加载房间信息失败:', error)
  }
}

// 生成邀请链接
const getInviteLink = (targetRole) => {
  // 检查数据完整性
  if (!roomInfo.value) {
    console.warn('[MatchPage] roomInfo 为空')
    return '链接生成失败：房间信息未加载'
  }
  
  if (!roomInfo.value.keys) {
    console.warn('[MatchPage] roomInfo.keys 为空', roomInfo.value)
    return '链接生成失败：房间 keys 未加载'
  }
  
  if (!roomInfo.value.keys[targetRole]) {
    console.warn(`[MatchPage] 缺少 ${targetRole} 的 key`, roomInfo.value.keys)
    return `链接生成失败：缺少 ${targetRole} 的 key`
  }
  
  const baseUrl = window.location.origin
  const key = roomInfo.value.keys[targetRole]
  
  return `${baseUrl}/?role=${targetRole}&key=${key}`
}

// 复制邀请链接
const copyInviteLink = async (role) => {
  const link = getInviteLink(role)
  try {
    await navigator.clipboard.writeText(link)
    copiedLinkRole.value = role
    setTimeout(() => {
      copiedLinkRole.value = ''
    }, 2000)
  } catch (error) {
    console.error('复制失败:', error)
    alert('复制失败，请手动复制')
  }
}

// 队伍资源（初始值：50调用点，1情报点）
const teamAResources = ref({
  cp: 50, // 调用点
  ip: 1   // 情报点
})

const teamBResources = ref({
  cp: 50,
  ip: 1
})

// 重置队伍资源的函数
const resetTeamResources = () => {
  teamAResources.value = {
    cp: 50,
    ip: 1
  }
  teamBResources.value = {
    cp: 50,
    ip: 1
  }
}

// 按钮事件处理
const handleStartMatch = () => {
  console.log('[MatchPage] 主持人点击开局')
  
  // 只发送请求到服务器，不进行任何本地处理
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'start_match'
    }))
    console.log('[MatchPage] 已发送开局请求到服务器')
  } else {
    console.warn('[MatchPage] WebSocket 未连接，无法发送消息')
  }
}


// 添加日志记录函数
const addLog = (type, text) => {
  const now = new Date()
  const time = now.toLocaleTimeString('zh-CN', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  })
  battleLogs.value.push({ type, text, time })
}

// 辅助函数：获取职业中文名
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

// 辅助函数：获取星级中文
const getRarityCn = (rarity) => {
  const map = {
    1: '一星',
    2: '二星',
    3: '三星',
    4: '四星',
    5: '五星',
    6: '六星'
  }
  return map[rarity] || ''
}

// 辅助函数：根据视角生成干员抓取日志文本
// winner: 'A' 或 'B'，表示获胜队伍
// operator: 干员对象
// userTeam: 当前用户的队伍 'A' 或 'B'
// userRole: 当前用户的角色
// teamAIntel: 队伍A是否消耗了情报点
// teamBIntel: 队伍B是否消耗了情报点
const generateCaptureLogText = (winner, operator, userTeam, userRole, teamAIntel, teamBIntel) => {
  if (!operator) {
    return `队伍${winner}抓取未知干员`
  }
  
  const winnerTeam = winner === 'A' ? 'A' : 'B'
  const professionCn = getClassCn(operator.profession) || '干员'
  
  // 主持人/观众：显示完整信息
  if (userRole === 'HOST' || userRole === 'SPECTATOR') {
    return `队伍${winnerTeam}抓取${operator.name || '未知干员'}`
  }
  
  // 选手视角
  if (userRole === 'PLAYER') {
    // 如果是获胜方，显示完整信息
    if (userTeam === winner) {
      return `队伍${winnerTeam}抓取${operator.name || '未知干员'}`
    }
    
    // 如果是失败方，根据是否消耗情报点显示不同信息
    const usedIntel = (userTeam === 'A' && teamAIntel) || (userTeam === 'B' && teamBIntel)
    
    if (usedIntel) {
      // 消耗了情报点：显示星级、职业、分支
      const rarityCn = operator.rarity ? getRarityCn(operator.rarity) : ''
      const subClass = operator.subClass || ''
      if (rarityCn && subClass) {
        return `队伍${winnerTeam}抓取${rarityCn}未知${professionCn}-${subClass}`
      } else if (rarityCn) {
        return `队伍${winnerTeam}抓取${rarityCn}未知${professionCn}`
      } else {
        return `队伍${winnerTeam}抓取未知${professionCn}`
      }
    } else {
      // 未消耗情报点：只显示职业
      return `队伍${winnerTeam}抓取未知${professionCn}`
    }
  }
  
  // 默认情况
  return `队伍${winnerTeam}抓取${operator.name || '未知干员'}`
}

// 获取职业图标路径
const getProfessionIconPath = (professionEn) => {
  if (!professionEn) return '/images/近卫.png' // 默认图标
  const professionCn = getClassCn(professionEn)
  return `/images/${professionCn}.png`
}

// 处理博弈获胜后的干员分配（构建信息差）
const handleBiddingWin = (winner, operator, cost, teamAIntel, teamBIntel) => {
  // 判断当前用户是否知道这个干员的详细信息
  // 规则：
  // 1. 对于获得干员的队伍、观众和主持人：显示完整信息（头像、名字、星级、分支）
  // 2. 对于对方队伍：
  //    - 未消耗情报点：只显示"未知职业+职业图标"
  //    - 消耗情报点：额外显示星级和分支（但不显示名字和头像）
  
  let iKnowDetails = false // 是否知道名字和头像
  let iKnowStarAndSubclass = false // 是否知道星级和分支
  
  if (userRole.value === 'HOST' || userRole.value === 'SPECTATOR') {
    // 主持人/观众：全知
    iKnowDetails = true
    iKnowStarAndSubclass = true
  } else if (userRole.value === 'PLAYER') {
    if (winner === userTeam.value) {
      // 自己队伍的干员：显示完整信息
      iKnowDetails = true
      iKnowStarAndSubclass = true
    } else {
      // 对方队伍的干员：
      // - 名字和头像永远不显示（只显示"未知+职业"）
      iKnowDetails = false
      // - 星级和分支：只有自己队伍买了情报才能看到
      if (userTeam.value === 'A' && teamAIntel) {
        iKnowStarAndSubclass = true
      } else if (userTeam.value === 'B' && teamBIntel) {
        iKnowStarAndSubclass = true
      }
    }
  }
  
  // 构建干员数据（根据信息差）
  const inventoryOp = {
    ...operator,
    realName: operator.name,
    cost: cost,
    // 显示控制
    name: iKnowDetails ? operator.name : `未知${getClassCn(operator.profession)}`,
    avatar: iKnowDetails ? operator.avatar : getProfessionIconPath(operator.profession),
    // 星级和分支：自己队伍的干员始终显示，对方队伍的干员需要购买情报才显示
    isStarRevealed: iKnowStarAndSubclass,
    isSubclassRevealed: iKnowStarAndSubclass,
    isBiddingBlindBox: true, // 标记这是博弈来的
    isFullyRevealed: iKnowDetails // 标记是否显示完整信息（名字和头像）
  }
  
  // 【修复 1】防止重复添加：强制使用 realName (真名) 进行查重
  // 无论显示的是"未知干员"还是真名，realName 都是唯一的
  if (winner === 'A') {
    // 检查 teamAOperators 中是否已经有这个 realName
    // 注意：有些旧数据可能没有 realName，回退到 name 判断
    const exists = teamAOperators.value.some(op => (op.realName || op.name) === inventoryOp.realName)
    if (!exists) {
      teamAOperators.value.push(inventoryOp)
    } else {
      console.warn('[MatchPage] 尝试重复添加干员到队伍A，已拦截:', inventoryOp.realName)
    }
  } else {
    const exists = teamBOperators.value.some(op => (op.realName || op.name) === inventoryOp.realName)
    if (!exists) {
      teamBOperators.value.push(inventoryOp)
    } else {
      console.warn('[MatchPage] 尝试重复添加干员到队伍B，已拦截:', inventoryOp.realName)
    }
  }
  
  console.log(`[MatchPage] 干员 ${operator.name} 已分配给队伍${winner}，当前用户是否知道详情: ${iKnowDetails}，是否知道星级和分支: ${iKnowStarAndSubclass}`)
}

// 辅助：处理获胜逻辑（仅更新数据，不负责动画）- 用于 result_show_start
const handleBiddingWinLogic = (result) => {
  if (!result || (result.winner === 'NONE' || result.winner === 'DRAW')) return
  
  // 调用原有的 handleBiddingWin 函数，但跳过动画部分
  handleBiddingWin(
    result.winner,
    result.operator,
    result.winCost,
    result.teamAIntel,
    result.teamBIntel
  )
}

// 【新增】辅助：显示动作气泡
const showActionBubble = (team, text) => {
  // 主持人侧和观众侧都要显示（选手侧不显示）
  if (userRole.value !== 'HOST' && userRole.value !== 'SPECTATOR') return

  const target = team === 'A' ? teamABubble : teamBBubble
  target.value.text = text
  target.value.visible = true
}

// 【新增】辅助：生成气泡文本
const getActionText = (actionType, amount = 0, usedIntel = false) => {
  let parts = []
  
  if (usedIntel) {
    parts.push('消耗情报点获取信息')
  }
  
  if (actionType === 'BID') {
    parts.push(`消耗${amount}点调用点进行博弈抓取`)
  } else if (actionType === 'REST') {
    // 修正文案：休息且用了情报点 -> 只回CP；没用 -> 回CP+IP
    parts.push(`最终决定本回合休息，恢复5点调用点${usedIntel ? '' : '和1点情报点'}`)
  } else if (actionType === 'TERMINATE') {
    parts.push(`终止！不再参与本轮博弈后续回合`)
  }
  
  // 组合文案
  if (parts.length === 0) return ''
  
  // 如果有两部分，用逗号连接；否则直接输出
  if (parts.length > 1) {
    return `选择${parts[0]}，且${parts[1]}！`
  } else {
    // 只有动作，没有情报点
    return `选择${parts[0]}！`
  }
}

// 【新增】比拼动画完成回调
const handleClashComplete = () => {
  showClashAnimation.value = false
  // 执行原有的结果展示流程
  if (pendingResultData.value) {
    executeResultSequence(pendingResultData.value)
    pendingResultData.value = null
  }
}

// 【重构】将原有的 result_show_start 内部逻辑封装为函数
const executeResultSequence = (result) => {
  // 1. 设置数据
  resultData.value = JSON.parse(JSON.stringify(result))
  
  // 2. 处理干员入库逻辑
  handleBiddingWinLogic(result)
  
  // 【修复】战术记录的信息迷雾
  const actA = result.teamAAction
  const actB = result.teamBAction
  
  // 辅助：生成针对特定视角的日志
  // targetTeam: 日志描述的队伍 ('A' 或 'B')
  // action: 该队伍的动作
  const generateLogForViewer = (targetTeam, action, viewerRole, viewerTeam) => {
    // 1. 主持人/观众：全知
    if (viewerRole === 'HOST' || viewerRole === 'SPECTATOR') {
      if (action.type === 'BID') return `队伍${targetTeam}选择消耗${action.bid}点调用点参与本回合干员的博弈抓取`
      if (action.type === 'REST') {
        const ipText = action.usedIntel ? '' : '，情报点+1'
        return `队伍${targetTeam}选择休息，调用点+5${ipText}`
      }
      if (action.type === 'TERMINATED') return `队伍${targetTeam}已终止，本回合不参与操作`
    }
    
    // 2. 选手视角
    if (viewerRole === 'PLAYER') {
      // 看自己：全知
      if (targetTeam === viewerTeam) {
        if (action.type === 'BID') return `队伍${targetTeam}选择消耗${action.bid}点调用点参与本回合干员的博弈抓取`
        if (action.type === 'REST') {
          const ipText = action.usedIntel ? '' : '，情报点+1'
          return `队伍${targetTeam}选择休息，调用点+5${ipText}`
        }
        if (action.type === 'TERMINATED') return `队伍${targetTeam}已终止，本回合不参与操作`
      }
      
      // 看对手：迷雾
      const myAction = viewerTeam === 'A' ? result.teamAAction : result.teamBAction
      const winner = result.winner
      // 败者特权判定：我是败者 且 我参与了竞价
      const isLoser = (winner === targetTeam) // 对手赢了 = 我输了
      const didIBid = (myAction && myAction.type === 'BID')
      const canSeeBid = isLoser && didIBid
      
      if (action.type === 'BID') {
        if (canSeeBid) {
          return `队伍${targetTeam}选择消耗${action.bid}点调用点参与本回合干员的博弈抓取` // 能看到钱，但看不到情报点
        } else {
          return `队伍${targetTeam}进行了博弈操作（数值未知）`
        }
      }
      if (action.type === 'REST') return `队伍${targetTeam}选择休息` // 不显示IP回复情况
      if (action.type === 'TERMINATED') return `队伍${targetTeam}已终止，本回合不参与操作`
    }
    return ''
  }

  // A队操作日志
  if (actA) {
    const logText = generateLogForViewer('A', actA, userRole.value, userTeam.value)
    if (logText) addLog('team-a', logText)
  }
  
  // B队操作日志
  if (actB) {
    const logText = generateLogForViewer('B', actB, userRole.value, userTeam.value)
    if (logText) addLog('team-b', logText)
  }
  
  // 获胜日志
  if (result.winner === 'A') {
    const logText = generateCaptureLogText('A', result.operator, userTeam.value, userRole.value, result.teamAIntel, result.teamBIntel)
    addLog('highlight', `${logText}！`)
  } else if (result.winner === 'B') {
    const logText = generateCaptureLogText('B', result.operator, userTeam.value, userRole.value, result.teamAIntel, result.teamBIntel)
    addLog('highlight', `${logText}！`)
  } else if (result.winner === 'DRAW') {
    addLog('system', `双方出价相同或均休息，触发熔断！`)
  } else if (result.winner === 'NONE') {
    addLog('system', `双方均休息，本回合无干员获取`)
  }
  
  // 4. 触发飞行动画
  flyAnimation.value = ''
  nextTick(() => {
    const winner = result.winner
    console.log('[MatchPage] 准备触发飞行动画，winner:', winner)
    if (winner === 'A') {
      flyAnimation.value = 'left'
    } else if (winner === 'B') {
      flyAnimation.value = 'right'
    } else if (winner === 'DRAW') {
      flyAnimation.value = 'shatter'
      if (centerConsoleRef.value) {
        centerConsoleRef.value.playShatterAnimation()
      }
    } else if (winner === 'NONE') {
      flyAnimation.value = 'return'
    }
    console.log('[MatchPage] flyAnimation 已设置为:', flyAnimation.value)
  })
  
  // 4. 延迟切换到 RESULT_SHOW 阶段 (显示全息面板)
  setTimeout(() => {
    console.log('[MatchPage] 动画结束，切换到 RESULT_SHOW 面板')
    // 再次确保数据存在
    if (!resultData.value && result) {
      resultData.value = JSON.parse(JSON.stringify(result))
    }
    
    gamePhase.value = 'RESULT_SHOW'
    isBidding.value = false
    flyAnimation.value = '' // 清空动画状态
    
    // 解锁
    isTransitioning.value = false
  }, 1500)
}

const handleStartBidding = () => {
  console.log('[MatchPage] 主持人点击开始博弈')
  
  // 只发送请求到服务器，不进行任何本地处理
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'start_bidding'
    }))
    console.log('[MatchPage] 已发送开始博弈请求到服务器')
  } else {
    console.warn('[MatchPage] WebSocket 未连接，无法发送消息')
  }
}

// 【新增】处理暂停游戏
const handlePause = () => {
  console.log('[MatchPage] 主持人点击暂停')
  
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'pause_game'
    }))
    console.log('[MatchPage] 已发送暂停请求到服务器')
  } else {
    console.warn('[MatchPage] WebSocket 未连接，无法发送消息')
  }
}

// 【新增】处理继续游戏
const handleResume = () => {
  console.log('[MatchPage] 主持人点击继续')
  
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'resume_game'
    }))
    console.log('[MatchPage] 已发送继续请求到服务器')
  } else {
    console.warn('[MatchPage] WebSocket 未连接，无法发送消息')
  }
}

// 购买情报
const handleBuyIntel = () => {
  // 【修复】暂停期间禁止购买情报
  if (isPaused.value) {
    console.warn('[MatchPage] 游戏已暂停，无法购买情报')
    return
  }
  
  const currentRes = userTeam.value === 'A' ? teamAResources.value : teamBResources.value
  if (currentRes.ip < 1) {
    alert('情报点不足！')
    return
  }
  
  // 只发送请求到服务器，等待服务器确认后再更新
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'buy_intel'
    }))
  } else {
    alert('网络未连接，无法购买情报')
  }
  
  // 注意：不再在这里扣减IP和设置intelUnlocked，等待服务器确认
}

// 选手是否已选择（用于禁用按钮）
const playerHasChosen = ref(false)
const playerChoiceText = ref('') // 选择的提示文字

const handleSelectAmount = (amount) => {
  // 仅仅是通知服务器记录预选档位，不做本地锁定
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'select_amount',
      amount: amount
    }))
    console.log('[MatchPage] 预选档位:', amount)
  }
}

const handleBid = (amount) => {
  console.log('[MatchPage] 选手出价:', amount)
  
  const currentRes = userTeam.value === 'A' ? teamAResources.value : teamBResources.value
  if (amount > currentRes.cp) {
    alert('调用点不足！')
    return
  }
  
  // 标记已选择并显示提示
  playerHasChosen.value = true
  playerChoiceText.value = '您在本回合代表您的队伍选择了博弈抓取选项'
  
  // 注意：闪烁效果由服务器广播触发，这里不再本地设置
  
  // 发送 WebSocket 消息，提交出价
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'bid',
      amount: amount
      }))
    }
  }
  
const handleRest = () => {
  console.log('[MatchPage] 选手选择休息')
  
  // 标记已选择并显示提示
  playerHasChosen.value = true
  playerChoiceText.value = '您在本回合代表您的队伍选择了休息选项'
  
  // 注意：闪烁效果由服务器广播触发，这里不再本地设置
  
  // 发送 WebSocket 消息，选择休息
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'rest'
    }))
  }
}

const handleTerminate = () => {
  console.log('[MatchPage] 选手选择终止')
  
  // 立即设置本地终止状态，禁用所有按钮
  isTerminated.value = true
  
  // 标记已选择并显示提示
  playerHasChosen.value = true
  playerChoiceText.value = '您在本回合代表您的队伍选择了终止选项'
  
  // 注意：闪烁效果由服务器广播触发，这里不再本地设置
  
  // 发送 WebSocket 消息，终止博弈
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'terminate'
    }))
  }
}

// =========================================
// 主持人操作函数
// =========================================

// 主持人：重新开局
const handleRestartGame = () => {
  console.log('[MatchPage] 主持人点击重新开局')
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'restart_game'
    }))
  }
}

// 主持人：重新开始博弈
const handleRestartBidding = () => {
  console.log('[MatchPage] 主持人点击重新开始博弈')
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'restart_bidding'
    }))
  }
}

// 辅助函数：检查干员是否为开局干员
const isOpeningOperator = (operatorName) => {
  return openingOperators.value.some(op => op.name === operatorName)
}

// 辅助函数：检查干员是否可以加入禁用池，并通知服务器
// 规则：
// 1. 开局干员：需要双方队伍都移除后，才能加入禁用池
// 2. 其他干员：只要从任意队伍移除，就可以加入禁用池
// 注意：禁用池是全局共享的，需要通过服务器同步
const checkAndAddOperatorToBanMap = (operatorName, subClass, professionCn) => {
  if (!operatorName) return false
  
  // 检查是否为开局干员
  const isOpening = isOpeningOperator(operatorName)
  
  if (isOpening) {
    // 开局干员：需要检查双方是否都已移除
    const inTeamA = teamAOperators.value.some(op => op.name === operatorName)
    const inTeamB = teamBOperators.value.some(op => op.name === operatorName)
    
    if (inTeamA || inTeamB) {
      // 还有队伍拥有该干员，不能加入禁用池
      console.log(`[MatchPage] 开局干员 ${operatorName} 仍有队伍拥有，暂不加入禁用池 (A: ${inTeamA}, B: ${inTeamB})`)
      return false
    }
    
    // 双方都已移除，可以加入禁用池
    console.log(`[MatchPage] 开局干员 ${operatorName} 双方都已移除，通知服务器加入禁用池`)
  }
  
  // 非开局干员或开局干员双方都已移除，通知服务器加入禁用池
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    store.socket.send(JSON.stringify({
      action: 'check_operator_ban',
      operatorName: operatorName,
      subClass: subClass,
      professionCn: professionCn,
      isOpeningOperator: isOpening,
      inTeamA: isOpening ? teamAOperators.value.some(op => op.name === operatorName) : false,
      inTeamB: isOpening ? teamBOperators.value.some(op => op.name === operatorName) : false
    }))
    console.log(`[MatchPage] 已通知服务器检查干员 ${operatorName} 是否可以加入禁用池`)
  }
  
  return true
}

// 辅助函数：将单个干员添加到禁用池（用于 takenOperators 中的干员个体）
const addOperatorToBanMap = (operatorName, subClass, professionCn) => {
  if (!operatorName) return
  
  // 如果 subClass 和 professionCn 未提供，尝试从干员数据中查找
  let finalSubClass = subClass
  let finalProfessionCn = professionCn
  
  if (!finalSubClass || !finalProfessionCn) {
    const opData = getOperatorByName(operatorName)
    if (opData) {
      finalSubClass = finalSubClass || opData.分支
      finalProfessionCn = finalProfessionCn || opData.职业
    }
  }
  
  if (!finalSubClass) {
    console.warn(`[MatchPage] 无法找到干员 ${operatorName} 的分支信息，跳过添加到禁用池`)
    return
  }
  
  // 如果该分支还未在禁用池中，初始化
  if (!bannedMap.value[finalSubClass]) {
    bannedMap.value[finalSubClass] = {
      professionCn: finalProfessionCn || getProfessionByBranch(finalSubClass) || '',
      operators: []
    }
  }
  
  // 检查该干员是否已存在
  const existingIndex = bannedMap.value[finalSubClass].operators.findIndex(op => op.name === operatorName)
  if (existingIndex === -1) {
    // 添加该干员个体到禁用池
    bannedMap.value[finalSubClass].operators.push({
      name: operatorName,
      avatar: `/icon/头像_${operatorName}.png`
    })
    console.log(`[MatchPage] 已添加干员个体 ${operatorName} 到禁用池（分支: ${finalSubClass}）`)
  }
}

// =========================================
// 🔌 WebSocket 消息核心处理 (关键修复点)
// =========================================
const handleGameEvent = (event) => {
  try {
    const data = event.detail // 从 CustomEvent 中获取数据
    console.log('[MatchPage] 收到事件分发:', data.type, data)

    // 1. 处理开局开始 (opening_start)
    if (data.type === 'opening_start') {
      console.log('[MatchPage] 服务器确认开局，播放动画')
      // 同步数据
      if (data.openingOperators) {
        openingOperators.value = data.openingOperators.map(op => ({
          ...op,
          // 确保职业中文名存在
          professionCn: op.professionCn || getClassCn(op.profession),
          avatar: op.avatar || `/icon/头像_${op.name}.png`
        }))
      }
      
      // 切换阶段
      gamePhase.value = 'OPENING_SHOW'
      currentRound.value = data.round || 1
      
      // 播放动画
      if (centerConsoleRef.value) {
        centerConsoleRef.value.playOpeningSequence()
      }
      
      // 启动开局倒计时 (5.5秒后，由服务器控制)
      openingProgress.value = 100
    }

    // 2. 处理开局倒计时进度更新 (opening_countdown)
    if (data.type === 'opening_countdown') {
      openingProgress.value = data.progress || 100
    }

    // 3. 处理开局倒计时完成 (opening_countdown_complete)
    if (data.type === 'opening_countdown_complete') {
      console.log('[MatchPage] 收到服务器倒计时完成消息')
      
      // 播放飞走动画
  if (centerConsoleRef.value) {
    centerConsoleRef.value.playFlyAnimation()
  }
  
      // 延迟1秒后通知服务器开局完成
  setTimeout(() => {
        // 分发干员到队伍
    const processedOps = openingOperators.value.map((op, index) => {
      const correctProfession = op.profession || getProfessionEn(op.professionCn)
      const correctProfessionCn = op.professionCn || getClassCn(correctProfession)
      
      return {
        ...op,
        profession: correctProfession,
        professionCn: correctProfessionCn,
            isThirdOperator: index === 2, // 标记第三个干员
            // 对于第三个干员，在选手视角需要显示"未知+职业"，所以保存原始名字
            name: op.name, // 保持原始名字，由 BattleSidePanel 根据角色判断显示
        cost: 0,
        isOpening: true // 【新增】标记这是开局干员，用于在队伍信息栏中过滤
      }
    })
    
    teamAOperators.value.push(...processedOps)
    teamBOperators.value.push(...processedOps)
    
    console.log('[MatchPage] 干员已分发到队伍A和B')
    
        // 通知服务器开局完成
    if (store.socket && store.socket.readyState === WebSocket.OPEN) {
      store.socket.send(JSON.stringify({
            action: 'opening_complete'
      }))
    }
  }, 1000)
}

    // 4. 处理开局完成 (opening_complete) -> 进入等待
    if (data.type === 'opening_complete') {
      console.log('[MatchPage] 开局展示结束，进入等待阶段')
      gamePhase.value = data.phase || 'WAITING'
      currentStage.value = 'GAME_ROUND'
      // 注意：isFirstRound 应该保持为 true，直到第一次点击"开始博弈"按钮时才设置为 false
      isBidding.value = false
      
      if (data.round) {
        currentRound.value = data.round
      }
    }

    // 5. 处理博弈动画开始 (bidding_animation_start)
    if (data.type === 'bidding_animation_start') {
      console.log('[MatchPage] 收到博弈动画指令')
      gamePhase.value = 'BIDDING_ANIMATION'
      isBidding.value = false // 动画期间不显示博弈UI
      currentBiddingOp.value = data.operator
      currentRound.value = data.round || currentRound.value
      // 第一次点击"开始博弈"后，将 isFirstRound 设置为 false
      if (isFirstRound.value) {
    isFirstRound.value = false
      }
      intelUnlocked.value = false
      flyAnimation.value = ''
      
      // 播放过场动画
      if (centerConsoleRef.value && centerConsoleRef.value.playBiddingSequence) {
        centerConsoleRef.value.playBiddingSequence(currentRound.value)
      }
    }

    // 6. 处理正式开始倒计时 (bidding_start)
    if (data.type === 'bidding_start') {
      console.log('[MatchPage] 正式开始博弈倒计时')
      resultData.value = null // 清空上一轮结果
      // 【修复】重置本轮情报点使用状态
      teamAUsedIntelCurrentRound.value = false
      teamBUsedIntelCurrentRound.value = false
      const wsOperator = data.operator
      
      // 更新干员数据
      if (wsOperator) {
        currentBiddingOp.value = {
          name: wsOperator.name,
          rarity: wsOperator.rarity,
          profession: wsOperator.profession,
          professionCn: wsOperator.professionCn || getClassCn(wsOperator.profession),
          subClass: wsOperator.subClass,
          avatar: wsOperator.avatar || `/icon/头像_${wsOperator.name}.png`,
          cost: 0,
          isFullyRevealed: false
        }
      }

      // 重置本轮状态
      intelUnlocked.value = false
      isResolving.value = false
      playerHasChosen.value = false // 重置选择状态
      playerChoiceText.value = ''
      // 重置队伍选择完成状态
      teamAChoiceComplete.value = false
      teamBChoiceComplete.value = false

      // 切换UI
      gamePhase.value = 'BIDDING'
      isBidding.value = true
      currentRound.value = data.round || currentRound.value
      
      // 【新增】更新单边模式状态
      if (userTeam.value === 'A') {
        isSingleSideMode.value = data.isSingleSideModeA || false
      } else if (userTeam.value === 'B') {
        isSingleSideMode.value = data.isSingleSideModeB || false
      }
      
      // 添加回合开始日志
      addLog('round', `博弈阶段 第${currentRound.value}回合`)
      
      // 【修复】完全依赖服务器控制进度条，不设置本地倒计时
      // 初始化值（服务器会通过 bidding_countdown 消息持续更新）
      biddingTimeLeft.value = data.timeLeft || 25
      biddingProgress.value = data.progress !== undefined ? data.progress : 100
      
      // 【关键修复】移除本地倒计时定时器，完全依赖服务器广播
      // 服务器会通过 bidding_countdown 消息每 100ms 发送一次更新
      if (biddingCountdownTimer.value) {
        clearInterval(biddingCountdownTimer.value)
        biddingCountdownTimer.value = null
      }
    }

    // 【修改】处理游戏暂停 (game_paused) - 支持不同阶段
    if (data.type === 'game_paused') {
      console.log('[MatchPage] 游戏已暂停，阶段:', data.phase, '剩余时间:', data.timeLeft)
      isPaused.value = true
      // 清除本地倒计时定时器（如果存在）
      if (biddingCountdownTimer.value) {
        clearInterval(biddingCountdownTimer.value)
        biddingCountdownTimer.value = null
      }
      // 更新阶段和剩余时间（如果服务器发来了）
      // 【关键修复】如果正在播放动画（gamePhase 是 BIDDING 但 flyAnimation 有值），不要立即切换阶段
      // 等待动画完成后再切换
      if (data.phase) {
        // 如果当前在 BIDDING 阶段且有动画正在播放，延迟切换阶段
        if (data.phase === 'RESULT_SHOW' && gamePhase.value === 'BIDDING' && flyAnimation.value) {
          console.log('[MatchPage] 暂停时检测到动画正在播放，延迟切换阶段')
          // 不立即切换，等待动画完成
        } else {
          gamePhase.value = data.phase
        }
      }
      if (data.timeLeft !== undefined) {
        biddingTimeLeft.value = data.timeLeft
        // 根据阶段计算进度
        if (data.phase === 'BIDDING') {
          biddingProgress.value = (data.timeLeft / 25) * 100
        } else if (data.phase === 'RESULT_SHOW') {
          biddingProgress.value = (data.timeLeft / 10) * 100
        } else if (data.phase === 'COOLDOWN') {
          biddingProgress.value = (data.timeLeft / 5) * 100
        }
      }
    }
    
    // 【修改】处理游戏继续 (game_resumed) - 支持不同阶段
    if (data.type === 'game_resumed') {
      console.log('[MatchPage] 游戏已继续，阶段:', data.phase, '剩余时间:', data.timeLeft)
      isPaused.value = false
      // 【修复问题2】完全依赖服务器广播，不设置本地倒计时
      // 恢复倒计时显示（使用服务器发来的值）
      if (data.timeLeft !== undefined) {
        biddingTimeLeft.value = data.timeLeft
      }
      if (data.progress !== undefined) {
        biddingProgress.value = data.progress
      } else if (data.timeLeft !== undefined) {
        // 如果没有 progress，根据阶段计算（兼容旧消息格式）
        if (data.phase === 'BIDDING') {
          biddingProgress.value = (data.timeLeft / 25) * 100
        } else if (data.phase === 'RESULT_SHOW') {
          biddingProgress.value = (data.timeLeft / 10) * 100
        } else if (data.phase === 'COOLDOWN') {
          biddingProgress.value = (data.timeLeft / 5) * 100
        }
      }
      // 更新阶段（如果服务器发来了）
      if (data.phase) {
        gamePhase.value = data.phase
      }
      // 【修复问题2】移除本地倒计时逻辑，完全依赖服务器广播
      // 不再启动本地倒计时定时器
    }
    
    // 【重构】8. 结果展示阶段 (result_show_start) - 必须在 bidding_countdown 之前处理
    if (data.type === 'result_show_start') {
      console.log('[MatchPage] 收到结果展示指令', data.result)
      
      // 1. 立即停止本地倒计时
      if (biddingCountdownTimer.value) {
        clearInterval(biddingCountdownTimer.value)
        biddingCountdownTimer.value = null
      }

      // 【修复 3】强制关闭气泡 (使用新对象触发响应式更新)
      teamABubble.value = { visible: false, text: '' }
      teamBBubble.value = { visible: false, text: '' }

      // 2. 上锁！防止倒计时消息打断动画
      isTransitioning.value = true

      // 3. 暂存数据
      pendingResultData.value = JSON.parse(JSON.stringify(data.result))
      
      // 4. 强制更新资源
      if (data.teamAResources) teamAResources.value = { ...data.teamAResources }
      if (data.teamBResources) teamBResources.value = { ...data.teamBResources }

      // 【修复 1】判定是否触发比拼动画
      const actA = data.result.teamAAction
      const actB = data.result.teamBAction
      
      // 确保数值类型正确
      const valA = (actA.type === 'BID' && actA.bid !== undefined) ? Number(actA.bid) : 0
      const valB = (actB.type === 'BID' && actB.bid !== undefined) ? Number(actB.bid) : 0
      
      const isA_Bid = actA.type === 'BID'
      const isB_Bid = actB.type === 'BID'

      console.log('[MatchPage] 动画判定:', { isA_Bid, isB_Bid, valA, valB })

      // 如果没有任何一方出价 (双方都休息/终止)，跳过动画
      if (!isA_Bid && !isB_Bid) {
        console.log('[MatchPage] 双方均未出价，跳过数字比拼动画')
        executeResultSequence(pendingResultData.value)
        pendingResultData.value = null
      } else {
        // 播放比拼动画
        // 使用 nextTick 确保 DOM 更新，并强制重新渲染组件
        showClashAnimation.value = false 
        nextTick(() => {
          clashValA.value = valA
          clashValB.value = valB
          showClashAnimation.value = true
          console.log('[MatchPage] 启动数字比拼动画', { valA, valB })
        })
      }
    }

    // 【重构】9. 通用倒计时 (bidding_countdown)
    if (data.type === 'bidding_countdown') {
      if (data.timeLeft !== undefined) biddingTimeLeft.value = data.timeLeft
      if (data.progress !== undefined) biddingProgress.value = data.progress
      
      // 【修改】数据补全逻辑（兜底方案）
      // 如果后端发来了 result 数据，且本地为空，说明 start 消息丢了
      // 【关键】但只有在 result_show_start 还没处理时才执行兜底逻辑
      // 如果 isTransitioning 为 true，说明 result_show_start 正在处理，不要干扰
      if (data.phase === 'RESULT_SHOW' && data.result && !resultData.value && !isTransitioning.value) {
          console.log('[MatchPage] 通过倒计时消息补全 resultData (start消息丢失)')
          
          // 【修复】强制关闭气泡
          teamABubble.value = { visible: false, text: '' }
          teamBBubble.value = { visible: false, text: '' }
          
          // 1. 上锁！防止倒计时消息打断动画
          isTransitioning.value = true
          
          // 2. 暂存数据
          pendingResultData.value = JSON.parse(JSON.stringify(data.result))
          
          // 3. 补全数据（用于显示）
          resultData.value = JSON.parse(JSON.stringify(data.result))
          handleBiddingWinLogic(data.result)
          
          // 4. 【修复】判定是否触发比拼动画（与 result_show_start 逻辑一致）
          const actA = data.result.teamAAction
          const actB = data.result.teamBAction
          
          // 确保数值类型正确
          const valA = (actA.type === 'BID' && actA.bid !== undefined) ? Number(actA.bid) : 0
          const valB = (actB.type === 'BID' && actB.bid !== undefined) ? Number(actB.bid) : 0
          
          const isA_Bid = actA.type === 'BID'
          const isB_Bid = actB.type === 'BID'

          console.log('[MatchPage] (兜底) 动画判定:', { isA_Bid, isB_Bid, valA, valB })

          // 如果没有任何一方出价 (双方都休息/终止)，跳过动画
          if (!isA_Bid && !isB_Bid) {
            console.log('[MatchPage] (兜底) 双方均未出价，跳过数字比拼动画')
            executeResultSequence(pendingResultData.value)
            pendingResultData.value = null
          } else {
            // 播放比拼动画
            showClashAnimation.value = false 
            nextTick(() => {
              clashValA.value = valA
              clashValB.value = valB
              showClashAnimation.value = true
              console.log('[MatchPage] (兜底) 启动数字比拼动画', { valA, valB })
            })
          }
          
          return; // 【重要】直接返回，不执行下面的相位同步逻辑，防止立即切换
      }

      // 相位同步逻辑
      if (data.phase && data.phase !== gamePhase.value) {
        // 【关键】如果正在播放动画（上锁状态），绝对不要切换到 RESULT_SHOW
        if (isTransitioning.value && data.phase === 'RESULT_SHOW') {
           console.log('[MatchPage] 动画播放中，忽略 RESULT_SHOW 切换请求')
           return
        }
        
        // 如果不在动画中，正常切换
        gamePhase.value = data.phase
      }
    }

    // 【新增】9. 冷却阶段 (cooldown_start)
    if (data.type === 'cooldown_start') {
      console.log('[MatchPage] 进入冷却阶段')
      
      // 1. 强制清除倒计时
      if (biddingCountdownTimer.value) {
        clearInterval(biddingCountdownTimer.value)
        biddingCountdownTimer.value = null
      }
      
      gamePhase.value = 'COOLDOWN'
      resultData.value = null // 关闭结果面板
      
      // 启动倒计时 (5s)
      biddingTimeLeft.value = 5
      biddingProgress.value = 100
    }

    // 10. 处理博弈结算 (bidding_resolve) - 保留用于兼容，但主要逻辑已由 result_show_start 处理
    if (data.type === 'bidding_resolve') {
      // 注意：现在这个消息主要用于触发飞行动画，结果展示由 result_show_start 处理
      handleBiddingResolved(data)
    }

    // 11. 处理情报解锁确认 (intel_unlocked)
    if (data.type === 'intel_unlocked') {
      // 如果是自己队伍解锁了，更新本地状态
      if (data.team === userTeam.value) {
        intelUnlocked.value = true
        // 记录日志（延迟记录，确保资源已更新）
        setTimeout(() => {
          const currentRes = userTeam.value === 'A' ? teamAResources.value : teamBResources.value
          const team = userTeam.value === 'A' ? 'team-a' : 'team-b'
          addLog(team, `队伍${userTeam.value === 'A' ? 'A' : 'B'}选择消耗1点情报点解锁额外信息，剩余情报点：${currentRes.ip}点`)
        }, 100) // 等待资源更新消息处理完成
      }
      
      // 【新增】观众逻辑：任意一方解锁，观众即解锁
      if (userRole.value === 'SPECTATOR') {
        intelUnlocked.value = true
        console.log('[MatchPage] 观众视角：检测到情报解锁，同步显示')
      }

      // 【修复 2】更新本轮情报点使用状态
      if (data.team === 'A') teamAUsedIntelCurrentRound.value = true
      if (data.team === 'B') teamBUsedIntelCurrentRound.value = true
      
      // 【修复 2】立即更新气泡 (主持人侧和观众侧都要显示，完全一致)
      // 只要是 HOST 或 SPECTATOR，就显示气泡（和观众侧完全一样）
      if (userRole.value === 'HOST' || userRole.value === 'SPECTATOR') {
        // 这里的判断放宽一点，只要不是 IDLE 或 TERMINATED 就可以显示
        if (gamePhase.value === 'BIDDING' || gamePhase.value === 'BIDDING_ANIMATION') {
          showActionBubble(data.team, `队伍${data.team}选择消耗情报点获取信息`)
        }
      }
    }

    // 10. 处理回到等待阶段 (bidding_waiting)
    if (data.type === 'bidding_waiting') {
      // 【修复】如果比赛已完全结束（双方都终止），不处理bidding_waiting消息
      // 因为all_terminated消息已经处理了状态切换
      if (isMatchFullyEnded.value) {
        console.log('[MatchPage] 比赛已完全结束，忽略bidding_waiting消息')
        return
      }
      
      gamePhase.value = 'WAITING'
      isBidding.value = false
      isResolving.value = false
      currentBiddingOp.value = null
      flyAnimation.value = ''
      intelUnlocked.value = false
      currentRound.value = data.round || currentRound.value
    }

    // 11. 处理资源更新 (update_resources)
    // 【修复问题1】确保资源更新不会被忽略，但 result_show_start 中的资源优先级更高
    if (data.type === 'update_resources') {
      // 如果当前不在结果展示阶段，或者 result_show_start 还没处理，则更新资源
      // 这样可以确保资源更新消息不会覆盖 result_show_start 中的资源
      if (gamePhase.value !== 'RESULT_SHOW' || !resultData.value) {
        if (data.team === 'A') {
          teamAResources.value = { ...data.resources }
          console.log('[MatchPage] 通过 update_resources 更新 A队资源:', teamAResources.value)
        } else if (data.team === 'B') {
          teamBResources.value = { ...data.resources }
          console.log('[MatchPage] 通过 update_resources 更新 B队资源:', teamBResources.value)
        }
      } else {
        console.log('[MatchPage] 忽略 update_resources（已在 result_show_start 中更新）')
      }
    }

    // 12. 处理错误消息 (error)
    if (data.type === 'error') {
      console.error('[MatchPage] 服务器返回错误:', data.message)
      alert(`服务器错误: ${data.message || '未知错误'}`)
    }

    // 13. 处理终止状态更新 (termination_update)
    if (data.type === 'termination_update') {
      if (userTeam.value === 'A') {
        isTerminated.value = data.teamA
        opponentTerminated.value = data.teamB
      } else if (userTeam.value === 'B') {
        isTerminated.value = data.teamB
        opponentTerminated.value = data.teamA
      }
      // 【新增】如果是主持人，记录两队状态
      if (userRole.value === 'HOST') {
        hostTeamAStatus.value.terminated = data.teamA
        hostTeamBStatus.value.terminated = data.teamB
      }
      console.log('[MatchPage] 终止状态更新:', { isTerminated: isTerminated.value, opponentTerminated: opponentTerminated.value })
    }

    // 14. 处理全部终止 (all_terminated)
    if (data.type === 'all_terminated') {
      // 【重要】同步禁用池状态（如果服务器发送了）
      if (data.bannedMap) {
        bannedMap.value = { ...data.bannedMap }
        console.log(`[MatchPage] 全部终止：已同步禁用池状态，包含 ${Object.keys(data.bannedMap).length} 个分支`)
      }
      if (data.takenOperators) {
        takenOperators.value = new Set(data.takenOperators)
        console.log(`[MatchPage] 全部终止：已同步已占用干员列表，共 ${data.takenOperators.length} 名`)
      }
      
      // 【修复】更新终止状态
      // 对于选手：根据队伍设置终止状态
      if (userTeam.value === 'A') {
        isTerminated.value = true
        opponentTerminated.value = true
      } else if (userTeam.value === 'B') {
        isTerminated.value = true
        opponentTerminated.value = true
      }
      // 【修复】对于主持人：更新两队终止状态
      if (userRole.value === 'HOST') {
        hostTeamAStatus.value.terminated = true
        hostTeamBStatus.value.terminated = true
        // 同时设置 isTerminated 和 opponentTerminated 为 true，以便按钮显示
        isTerminated.value = true
        opponentTerminated.value = true
      }
      
      // 【修复】设置比赛完全结束状态（用于主持人按钮显示）
      isMatchFullyEnded.value = true
      
      console.log('[MatchPage] 双方终止，直接进入等待阶段（跳过攻略准备阶段）')
      gamePhase.value = 'WAITING' // 【修改】直接进入等待阶段，允许主持人重新开局/重新开始博弈
      isBidding.value = false
      // 清理倒计时
      if (biddingCountdownTimer.value) {
        clearInterval(biddingCountdownTimer.value)
        biddingCountdownTimer.value = null
      }
    }
    
    // 15. 处理博弈回合内选择状态播报 (choice_status_flash) - 绿色闪烁
    if (data.type === 'choice_status_flash') {
      console.log('[MatchPage] 收到选择状态播报:', data.team, data.action, data.amount)
      // 根据队伍设置闪烁效果
      if (data.team === 'A') {
        teamAChoiceComplete.value = true
        setTimeout(() => { teamAChoiceComplete.value = false }, 3000)
      } else if (data.team === 'B') {
        teamBChoiceComplete.value = true
        setTimeout(() => { teamBChoiceComplete.value = false }, 3000)
      }

      // 【修复】只在博弈阶段显示气泡，防止在结果展示阶段显示（主持人侧和观众侧完全一致）
      if (gamePhase.value === 'BIDDING' && (userRole.value === 'HOST' || userRole.value === 'SPECTATOR')) {
        const actionType = data.action || 'BID' // 默认为 BID
        const amount = data.amount || 0
        // 【修复】从实时状态获取是否使用了情报点
        const usedIntel = data.team === 'A' ? teamAUsedIntelCurrentRound.value : teamBUsedIntelCurrentRound.value
        const text = getActionText(actionType, amount, usedIntel)
        if (text) {
          showActionBubble(data.team, `队伍${data.team}${text}`)
        }
      }
    }
    
    // 16. 处理终止状态播报 (terminate_status_flash) - 红色闪烁
    if (data.type === 'terminate_status_flash') {
      console.log('[MatchPage] 收到终止状态播报:', data.team)
      // 只在等待阶段显示红色闪烁
      if (gamePhase.value === 'WAITING') {
        if (data.team === 'A') {
          teamATerminatedInWaiting.value = true
          setTimeout(() => { teamATerminatedInWaiting.value = false }, 3000)
        } else if (data.team === 'B') {
          teamBTerminatedInWaiting.value = true
          setTimeout(() => { teamBTerminatedInWaiting.value = false }, 3000)
        }
      }

      // 【新增】气泡显示（主持人/观众视角，完全一致）- 只在博弈阶段显示
      if (gamePhase.value === 'BIDDING' && (userRole.value === 'HOST' || userRole.value === 'SPECTATOR')) {
        showActionBubble(data.team, `队伍${data.team}选择终止！不再参与本轮博弈后续回合！`)
      }
    }
    
    // 【已删除】攻略准备阶段相关消息处理已全部移除
    
    // 20. 处理禁用池更新 (ban_pool_update) - 服务器广播的全局禁用池更新
    if (data.type === 'ban_pool_update') {
      console.log(`[MatchPage] 收到禁用池更新消息:`, data)
      // 服务器现在发送完整的 bannedMap 和 takenOperators
      if (data.bannedMap) {
        bannedMap.value = { ...data.bannedMap } // 使用展开运算符创建新对象，确保响应式更新
        const totalOps = Object.values(data.bannedMap).reduce((sum, group) => {
          return sum + (group.operators?.length || 0)
        }, 0)
        console.log(`[MatchPage] 禁用池已更新，包含 ${Object.keys(data.bannedMap).length} 个分支，共 ${totalOps} 名干员`, data.bannedMap)
      } else {
        console.warn(`[MatchPage] 禁用池更新消息中缺少 bannedMap`)
      }
      if (data.takenOperators) {
        takenOperators.value = new Set(data.takenOperators)
        console.log(`[MatchPage] 已占用干员列表已更新，共 ${data.takenOperators.length} 名`, Array.from(takenOperators.value))
      }
    }
    
    // 21. 处理游戏回溯 (game_restore)
    if (data.type === 'game_restore') {
      console.log('[MatchPage] 执行时空回溯...', data.snapshot)
      const snap = data.snapshot
      
      // 【关键修复】处理 PRE_OPENING 阶段：将其视为 OPENING 阶段处理
      // 这样前端能正确显示"开局"按钮，而不是因为未知的 phase 而报错
      const targetPhase = snap.gamePhase === 'PRE_OPENING' ? 'OPENING' : snap.gamePhase
      
      // 暴力覆盖本地状态
      gamePhase.value = targetPhase
      currentRound.value = snap.currentRound
      isBidding.value = snap.isBidding
      isFirstRound.value = snap.isFirstRound
      
      // 资源
      teamAResources.value = snap.teamAResources
      teamBResources.value = snap.teamBResources
      
      // 部署（已废弃的攻略准备阶段相关，保留兼容性）
      // teamADeployed 和 teamBDeployed 已不再使用，但保留兼容性处理
      // if (snap.teamADeployed) teamADeployed.value = snap.teamADeployed || []
      // if (snap.teamBDeployed) teamBDeployed.value = snap.teamBDeployed || []
      
      // 集合类型还原 (Array -> Set)
      bannedBranches.value = new Set(snap.bannedBranches || [])
      takenOperators.value = new Set(snap.takenOperators || [])
      bannedMap.value = snap.bannedMap || {}
      
      // 日志
      battleLogs.value = snap.battleLogs || []
      
      // 终止状态
      if (snap.serverStates) {
        if (userTeam.value === 'A') {
          isTerminated.value = snap.serverStates.teamATerminated
          opponentTerminated.value = snap.serverStates.teamBTerminated
        } else if (userTeam.value === 'B') {
          isTerminated.value = snap.serverStates.teamBTerminated
          opponentTerminated.value = snap.serverStates.teamATerminated
        }
        // 主持人也需要更新
        if (userRole.value === 'HOST') {
          hostTeamAStatus.value.terminated = snap.serverStates.teamATerminated
          hostTeamBStatus.value.terminated = snap.serverStates.teamBTerminated
        }
      }
      
      // 开局干员（必须先恢复，才能用于标记第3个干员和数据清洗）
      openingOperators.value = snap.openingOperators || []
      
      // =======================================================
      // 【逻辑修正】数据清洗：标记开局干员 & 智能迷雾处理
      // =======================================================
      const processRestoredList = (list, ownerTeam) => {
        return list.map(op => {
          // 1. 修复开局干员显示问题
          // 检查该干员是否存在于开局公共牌中
          const isOpeningOp = openingOperators.value.some(o => o.name === op.name)
          
          if (isOpeningOp) {
            op.isOpening = true // 标记后，BattleSidePanel 会自动过滤不显示
            // 标记第3个干员的特殊显示状态
            const index = openingOperators.value.findIndex(o => o.name === op.name)
            if (index === 2) {
              op.isThirdOperator = true
            }
            return op // 开局干员无需迷雾处理，直接返回
          }
          
          // 2. 修复博弈干员的迷雾显示 (Smart Fog of War)
          op.isBiddingBlindBox = true 
          
          // 判断是否我是这个干员的对手（例如我是B队，看A队的干员）
          let iAmOpponent = false
          if (userRole.value === 'PLAYER') {
            if (userTeam.value === 'A' && ownerTeam === 'B') iAmOpponent = true
            if (userTeam.value === 'B' && ownerTeam === 'A') iAmOpponent = true
          }
          
          if (iAmOpponent) {
            // 我是对手，需要检查我当时是否买了情报 (读取后端传来的 revealedToOpponent)
            // 注意：服务器存的是 "revealedToOpponent"，正好对应 "我是否解锁了它"
            const isUnlocked = op.revealedToOpponent === true
            
            const professionCn = op.professionCn || getClassCn(op.profession)
            
            if (isUnlocked) {
              // 情况A：买过情报 -> 显示"半盲"状态 (未知职业 + 星级 + 分支)
              op.name = `未知${professionCn}`
              op.avatar = getProfessionIconPath(op.profession) // 显示职业图标
              op.isFullyRevealed = false // 不显示真名/真头像
              op.isStarRevealed = true   // 显示星级
              op.isSubclassRevealed = true // 显示分支
            } else {
              // 情况B：没买情报 -> 显示"全盲"状态 (未知职业)
              op.name = `未知${professionCn}`
              op.avatar = getProfessionIconPath(op.profession)
              op.isFullyRevealed = false
              op.isStarRevealed = false
              op.isSubclassRevealed = false
            }
          } else {
            // 我是自己人/主持人/观众 -> 显示完整信息
            if (!op.realName) op.realName = op.name
            op.isFullyRevealed = true
            op.isStarRevealed = true
            op.isSubclassRevealed = true
          }
          
          return op
        })
      }
      
      // 应用清洗逻辑（替换原来的简单赋值）
      teamAOperators.value = processRestoredList(snap.teamAOperators || [], 'A')
      teamBOperators.value = processRestoredList(snap.teamBOperators || [], 'B')
      
      // 重置临时状态
      currentBiddingOp.value = null
      flyAnimation.value = ''
      intelUnlocked.value = false
      // 【新增】重置暂停状态
      isPaused.value = false
      
      alert('种子加载/中途加入成功！')
    }
    
    // 21. 处理游戏重置 (game_reset)
    if (data.type === 'game_reset') {
      // 重置终止状态
      isTerminated.value = false
      opponentTerminated.value = false
      // 【修复】重置比赛完全结束状态
      isMatchFullyEnded.value = false
      // 【新增】重置暂停状态
      isPaused.value = false
      // 【修复】重置主持人的终止状态
      if (userRole.value === 'HOST') {
        hostTeamAStatus.value.terminated = false
        hostTeamBStatus.value.terminated = false
      }
      
      // 【修复 3】强制清理页面上残留的信息气泡
      teamABubble.value = { visible: false, text: '' }
      teamBBubble.value = { visible: false, text: '' }
      
      // 【额外修复】清理数字比拼动画状态
      showClashAnimation.value = false
      
      // 重置资源
      teamAResources.value = { cp: 50, ip: 1 }
      teamBResources.value = { cp: 50, ip: 1 }
      // 重置轮次（如果是FULL模式）
      if (data.mode === 'FULL') {
        currentRound.value = 1
        isFirstRound.value = true
        openingOperators.value = []
        // FULL模式：清空队伍干员列表（因为服务器已经将上一轮的干员加入禁用池并清空）
        teamAOperators.value = []
        teamBOperators.value = []
      }
      // 【重要】BIDDING 模式（重新博弈）时，以下状态会被保留（不重置）：
      // - teamAOperators, teamBOperators (队伍背包，但服务器已清空并加入禁用池)
      // - bannedBranches, takenOperators, bannedMap (禁用池)
      // - openingOperators (开局干员，仅在 FULL 模式时清除)
      // - currentRound, isFirstRound (轮次信息，仅在 FULL 模式时重置)
      // 跳转到对应 phase
      gamePhase.value = data.phase
      console.log('[MatchPage] 游戏重置，模式:', data.mode, '阶段:', data.phase)
    }
    
    // 【已删除】strategy_ops_deployed 消息处理已移除（攻略准备阶段已删除）

    // 21. 处理单边模式倒计时结束 (bidding_timeout_single_mode)
    if (data.type === 'bidding_timeout_single_mode') {
      // 单边模式：倒计时结束但不结算，等待未终止方操作
      // 这里不需要做任何操作，只是通知倒计时已结束
      console.log('[MatchPage] 单边模式：倒计时结束，等待未终止方操作')
    }

  } catch (error) {
    console.error('[MatchPage] 消息处理错误:', error)
  }
}

// 处理博弈结算结果
const handleBiddingResolved = (data) => {
  // 【修复】检测比赛结束的条件加强：
  // 1. 显式的 isMatchEnded 标记
  // 2. 或者 winner 为 'NONE' (说明双方都终止了)
  const isEnd = data.isMatchEnded || data.winner === 'NONE';
  
  if (isEnd) {
    console.log('[前端] 判定比赛结束（双方终止）', { isMatchEnded: data.isMatchEnded, winner: data.winner })
    isMatchFullyEnded.value = true // 立即设置，确保按钮状态准备就绪
    
    // 【关键修复】立即设置终止状态，确保按钮能正确显示（不等待 all_terminated 消息）
    // 对于选手：根据队伍设置终止状态
    if (userTeam.value === 'A') {
      isTerminated.value = true
      opponentTerminated.value = true
    } else if (userTeam.value === 'B') {
      isTerminated.value = true
      opponentTerminated.value = true
    }
    // 【关键修复】对于主持人：立即设置两队终止状态，确保按钮显示
    if (userRole.value === 'HOST') {
      hostTeamAStatus.value.terminated = true
      hostTeamBStatus.value.terminated = true
      // 同时设置 isTerminated 和 opponentTerminated 为 true，以便按钮显示
      isTerminated.value = true
      opponentTerminated.value = true
    }
    
    // 更新资源
    if (data.teamAResources) {
      teamAResources.value = { ...data.teamAResources }
    }
    if (data.teamBResources) {
      teamBResources.value = { ...data.teamBResources }
    }
    
    // 处理日志
    const actA = data.teamAAction
    const actB = data.teamBAction
    
    if (actA && actA.type === 'TERMINATED') {
      addLog('team-a', `队伍A已终止，本回合不参与操作，资源不变`)
    }
    if (actB && actB.type === 'TERMINATED') {
      addLog('team-b', `队伍B已终止，本回合不参与操作，资源不变`)
    }
    
    // 处理干员显示（双方终止，干员返回池子）
    if (data.operator) {
      currentBiddingOp.value = {
        name: data.operator.name,
        rarity: data.operator.rarity,
        profession: data.operator.profession,
        professionCn: data.operator.professionCn || getClassCn(data.operator.profession),
        subClass: data.operator.subClass,
        avatar: data.operator.avatar || `/icon/头像_${data.operator.name}.png`,
        cost: 0,
        isFullyRevealed: true
      }
      intelUnlocked.value = true
    }
    
    // 【修改】触发绿色数据回收动画，而不是破碎动画
    flyAnimation.value = 'return'
    
    // 立即切换界面（不需要等待动画，因为双方都终止了）
    console.log('[前端] 双方终止，立即切换到等待阶段')
    gamePhase.value = 'WAITING'
    isBidding.value = false
    isResolving.value = false
    
    // 清理倒计时
    if (biddingCountdownTimer.value) {
      clearInterval(biddingCountdownTimer.value)
      biddingCountdownTimer.value = null
    }
    
    // 延迟清理干员显示（让用户看到干员返回池子的效果）
    setTimeout(() => {
      currentBiddingOp.value = null
      flyAnimation.value = ''
      intelUnlocked.value = false
    }, 2000)
    
    return // 结束处理，不再执行后续的正常结算逻辑
  }
  
  isResolving.value = true
  
  // 【关键修复】直接使用服务器传来的资源值（服务器已计算好）
  if (data.teamAResources) {
    teamAResources.value = { ...data.teamAResources }
  }
  if (data.teamBResources) {
    teamBResources.value = { ...data.teamBResources }
  }
  
  // 处理资源结算和日志
  const actA = data.teamAAction
  const actB = data.teamBAction
  
  // A队日志
  if (actA) {
    if (actA.type === 'BID') {
      addLog('team-a', `队伍A选择消耗${actA.bid}点调用点参与本回合干员的博弈抓取，剩余调用点：${teamAResources.value.cp}点`)
    } else if (actA.type === 'REST') {
      const ipText = actA.usedIntel ? '' : `，情报点+1，剩余情报点：${teamAResources.value.ip}点`
      addLog('team-a', `队伍A选择休息，调用点+5，剩余调用点：${teamAResources.value.cp}点${ipText}`)
    } else if (actA.type === 'TERMINATED') {
      addLog('team-a', `队伍A已终止，本回合不参与操作，资源不变`)
    } else if (actA.type === 'NO_ACTION') {
      addLog('team-a', `队伍A单边模式超时，但调用点不足10，无法强制出价，资源不变`)
    }
  }
  
  // B队日志
  if (actB) {
    if (actB.type === 'BID') {
      addLog('team-b', `队伍B选择消耗${actB.bid}点调用点参与本回合干员的博弈抓取，剩余调用点：${teamBResources.value.cp}点`)
    } else if (actB.type === 'REST') {
      const ipText = actB.usedIntel ? '' : `，情报点+1，剩余情报点：${teamBResources.value.ip}点`
      addLog('team-b', `队伍B选择休息，调用点+5，剩余调用点：${teamBResources.value.cp}点${ipText}`)
    } else if (actB.type === 'TERMINATED') {
      addLog('team-b', `队伍B已终止，本回合不参与操作，资源不变`)
    } else if (actB.type === 'NO_ACTION') {
      addLog('team-b', `队伍B单边模式超时，但调用点不足10，无法强制出价，资源不变`)
    }
  }
  
  // 注意：购买情报的日志已在 intel_unlocked 消息处理时记录，这里不再重复记录
  
  // 处理结果动画和干员分配
  if (data.winner === 'A') {
    flyAnimation.value = 'left'
    handleBiddingWin('A', data.operator, data.winCost, data.teamAIntel, data.teamBIntel)
    
    // 记录获胜日志（根据视角差异生成不同内容）
    const logText = generateCaptureLogText(
      'A',
      data.operator,
      userTeam.value,
      userRole.value,
      data.teamAIntel,
      data.teamBIntel
    )
    addLog('highlight', `${logText}！`)
    
    // 注意：博弈回合内被抓走的干员个体名字不会被纳入禁用池！
    // 只有当他们从队伍信息栏背面的干员信息栏移除后，才会被纳入禁用池
  } else if (data.winner === 'B') {
    flyAnimation.value = 'right'
    handleBiddingWin('B', data.operator, data.winCost, data.teamAIntel, data.teamBIntel)
    
    // 记录获胜日志（根据视角差异生成不同内容）
    const logText = generateCaptureLogText(
      'B',
      data.operator,
      userTeam.value,
      userRole.value,
      data.teamAIntel,
      data.teamBIntel
    )
    addLog('highlight', `${logText}！`)
    
    // 注意：博弈回合内被抓走的干员个体名字不会被纳入禁用池！
    // 只有当他们从队伍信息栏背面的干员信息栏移除后，才会被纳入禁用池
  } else {
    // 平局/双休：破碎动画
    // 在破碎动画开始时，立即揭露干员的全部内容（对所有角色）
    if (data.operator) {
      currentBiddingOp.value = {
        name: data.operator.name,
        rarity: data.operator.rarity,
        profession: data.operator.profession,
        professionCn: data.operator.professionCn || getClassCn(data.operator.profession),
        subClass: data.operator.subClass,
        avatar: data.operator.avatar || `/icon/头像_${data.operator.name}.png`,
        cost: 0,
        isFullyRevealed: true // 标记为完全揭露
      }
      // 强制解锁情报显示（即使选手没有购买情报）
      intelUnlocked.value = true
    }
    
    flyAnimation.value = 'shatter'
    if (centerConsoleRef.value) {
      centerConsoleRef.value.playShatterAnimation()
    }
    
    // 更新禁用池：添加整个分支的所有干员
    if (data.operator && data.operator.subClass) {
      const subClass = data.operator.subClass
      bannedBranches.value.add(subClass)
      
      // 如果该分支还未在禁用池中，初始化并添加该分支的所有干员
      if (!bannedMap.value[subClass]) {
        // 获取职业信息（优先使用服务器传来的，否则从分支数据中查找）
        const professionCn = data.operator.professionCn || getProfessionByBranch(subClass) || getClassCn(data.operator.profession)
        
        // 获取该分支的所有干员
        const branchOperators = getOperatorsByBranch(subClass)
        
        // 转换为显示格式
        const operatorsList = branchOperators.map(op => ({
          name: op.干员,
          avatar: `/icon/头像_${op.干员}.png`
        }))
        
        bannedMap.value[subClass] = {
          professionCn: professionCn,
          operators: operatorsList
        }
        
        console.log(`[MatchPage] 分支 ${subClass} 被禁用，已添加 ${operatorsList.length} 名干员到禁用池:`, operatorsList.map(o => o.name))
        
        // 记录禁用日志（平局/双休时，干员信息对所有角色都完全揭露）
        const logProfessionCn = data.operator.professionCn || getProfessionByBranch(subClass) || getClassCn(data.operator.profession)
        addLog('system', `本回合所展示干员"${data.operator.name}"及其职业分支"${logProfessionCn}-${subClass}"的所有干员均被纳入禁用池`)
      } else {
        // 如果分支已存在，检查是否有新干员需要添加（防止重复）
        const existingNames = new Set(bannedMap.value[subClass].operators.map(o => o.name))
        const branchOperators = getOperatorsByBranch(subClass)
        
        branchOperators.forEach(op => {
          if (!existingNames.has(op.干员)) {
            bannedMap.value[subClass].operators.push({
              name: op.干员,
              avatar: `/icon/头像_${op.干员}.png`
            })
          }
        })
      }
    }
  }
  
  // 2秒后回到等待阶段
  setTimeout(() => {
    gamePhase.value = 'WAITING'
    isResolving.value = false
    currentBiddingOp.value = null
    flyAnimation.value = ''
    intelUnlocked.value = false
  }, 2000)
}

onMounted(() => {
  console.log('[MatchPage] 挂载完成，开始监听 WebSocket')
  
  // 【关键修改】先检查是否有中途加入的数据，如果有则跳过初始化重置
  const hasPendingRestore = !!store.pendingRestoreData
  
  if (!hasPendingRestore) {
    // 只有在没有中途加入数据时才进行初始化清理
    // 初始化清理
    resetTeamResources()
    teamAOperators.value = []
    teamBOperators.value = []
    
    // 重置游戏阶段和状态
    gamePhase.value = 'OPENING'
    currentStage.value = 'OPENING'
    currentRound.value = 1
    isBidding.value = false
    isFirstRound.value = true
    // 重置终止状态
    isTerminated.value = false
    opponentTerminated.value = false
    // 【新增】重置暂停状态
    isPaused.value = false
    // 【修复】重置主持人的终止状态
    if (userRole.value === 'HOST') {
      hostTeamAStatus.value.terminated = false
      hostTeamBStatus.value.terminated = false
    }
    
    // 清理开局相关状态
    openingOperators.value = []
    openingProgress.value = 100
    
    // 清空日志
    battleLogs.value = []
    
    // 【新增】初始化比赛状态（用于支持开局前的中途加入）
    // 主持人进入 MatchPage 时，初始化 PRE_OPENING 状态，让新用户能中途加入
    if (userRole.value === 'HOST' && !hasPendingRestore) {
      console.log('[MatchPage] 主持人进入比赛界面，初始化比赛状态')
      // 延迟一小段时间确保 WebSocket 已连接
      setTimeout(() => {
        if (store.socket && store.socket.readyState === WebSocket.OPEN) {
          store.socket.send(JSON.stringify({
            action: 'init_match_state'
          }))
          console.log('[MatchPage] 已发送初始化状态请求到服务器')
        } else {
          console.warn('[MatchPage] WebSocket 未连接，等待连接后发送初始化状态请求')
          // 如果 WebSocket 未连接，等待连接后再发送
          const checkSocket = setInterval(() => {
            if (store.socket && store.socket.readyState === WebSocket.OPEN) {
              store.socket.send(JSON.stringify({
                action: 'init_match_state'
              }))
              console.log('[MatchPage] WebSocket 已连接，已发送初始化状态请求')
              clearInterval(checkSocket)
            }
          }, 500)
          
          // 10秒后停止检查
          setTimeout(() => {
            clearInterval(checkSocket)
          }, 10000)
        }
      }, 300)
    }
  }
  
  // 【关键修改】监听 window 事件，而不是直接监听 socket
  // 这样能确保消息通过 Store 统一分发，避免 socket 实例变化导致监听失效
  window.addEventListener('game-socket-message', handleGameEvent)
  console.log('[MatchPage] 已添加全局游戏事件监听')
  
  // 【新增】加载房间信息（用于邀请链接）
  if (userRole.value === 'HOST') {
    loadRoomInfo()
    
    // 延迟检查，确保数据已加载
    setTimeout(() => {
      if (!roomInfo.value || !roomInfo.value.keys || 
          !roomInfo.value.keys.HOST || 
          !roomInfo.value.keys.TEAM_A || 
          !roomInfo.value.keys.TEAM_B || 
          !roomInfo.value.keys.SPECTATOR) {
        console.warn('[MatchPage] 房间信息不完整，无法生成邀请链接')
        console.warn('[MatchPage] 当前 roomInfo:', roomInfo.value)
        console.warn('[MatchPage] 建议：请确保在创建房间后，房间信息已正确保存到 localStorage')
      } else {
        console.log('[MatchPage] 房间信息已完整加载，可以生成邀请链接')
      }
    }, 500)
  }
  
  // 【新增】检查是否有中途加入的数据
  if (hasPendingRestore) {
    console.log('[MatchPage] 检测到中途加入数据，执行状态恢复...')
    
    const snap = store.pendingRestoreData
    
    // 复用已有的 game_restore 逻辑
    // 构造一个模拟的 event 对象
    const mockEvent = {
      detail: {
        type: 'game_restore',
        snapshot: snap
      }
    }
    
    handleGameEvent(mockEvent)
    
    // 额外处理：如果正处于博弈倒计时中，需要手动修正时间
    if (snap.isBidding && snap.currentBiddingOp) {
      currentBiddingOp.value = snap.currentBiddingOp
      isBidding.value = true // 确保 isBidding 状态正确
      
      // 恢复倒计时显示
      if (snap.biddingTimeLeft !== undefined && snap.biddingTimeLeft > 0) {
        biddingTimeLeft.value = snap.biddingTimeLeft
        // 【修复】完全依赖服务器控制进度条
        // 如果有进度值，使用进度值；否则根据时间计算（兼容旧数据）
        biddingProgress.value = snap.biddingProgress !== undefined ? snap.biddingProgress : (snap.biddingTimeLeft / 25) * 100
        
        // 【关键修复】移除本地倒计时定时器，完全依赖服务器广播
        // 服务器会通过 bidding_countdown 消息持续更新进度
        if (biddingCountdownTimer.value) {
          clearInterval(biddingCountdownTimer.value)
          biddingCountdownTimer.value = null
        }
        
        console.log(`[MatchPage] 已恢复博弈倒计时，剩余时间: ${snap.biddingTimeLeft}秒`)
      }
    }
    
    // 恢复终止状态（如果快照中有）
    if (snap.serverStates) {
      if (userTeam.value === 'A') {
        isTerminated.value = snap.serverStates.teamATerminated
        opponentTerminated.value = snap.serverStates.teamBTerminated
      } else if (userTeam.value === 'B') {
        isTerminated.value = snap.serverStates.teamBTerminated
        opponentTerminated.value = snap.serverStates.teamATerminated
      }
      // 主持人也需要更新
      if (userRole.value === 'HOST') {
        hostTeamAStatus.value.terminated = snap.serverStates.teamATerminated
        hostTeamBStatus.value.terminated = snap.serverStates.teamBTerminated
        isTerminated.value = snap.serverStates.teamATerminated
        opponentTerminated.value = snap.serverStates.teamBTerminated
      }
      
      // 如果双方都终止了，设置比赛结束状态
      if (snap.serverStates.teamATerminated && snap.serverStates.teamBTerminated) {
        isMatchFullyEnded.value = true
      }
    }
    
    // 清空暂存，防止刷新后重复触发
    store.pendingRestoreData = null
    console.log('[MatchPage] 中途加入状态恢复完成')
  }
})

// =========================================
// 种子功能：获取/加载比赛种子
// =========================================

// 生成比赛种子
const generateGameSeed = () => {
  // 收集当前所有核心状态
  const gameStateSnapshot = {
    // 基础流程
    gamePhase: gamePhase.value,
    currentRound: currentRound.value,
    isBidding: isBidding.value,
    isFirstRound: isFirstRound.value,
    
    // 资源
    teamAResources: { ...teamAResources.value },
    teamBResources: { ...teamBResources.value },
    
    // 队伍背包 (干员列表)
    teamAOperators: [...teamAOperators.value],
    teamBOperators: [...teamBOperators.value],
    
    // 禁用与占用
    bannedBranches: Array.from(bannedBranches.value),
    takenOperators: Array.from(takenOperators.value),
    bannedMap: { ...bannedMap.value },
    
    // 日志
    battleLogs: [...battleLogs.value],
    
    // 开局干员
    openingOperators: [...openingOperators.value],
    
    // 终止状态（显式存储两队状态）
    serverStates: {
      teamATerminated: userRole.value === 'HOST' ? hostTeamAStatus.value.terminated : (userTeam.value === 'A' ? isTerminated.value : opponentTerminated.value),
      teamBTerminated: userRole.value === 'HOST' ? hostTeamBStatus.value.terminated : (userTeam.value === 'B' ? isTerminated.value : opponentTerminated.value)
    }
  }
  
  // 序列化 + Base64 编码 (处理中文乱码)
  try {
    const jsonStr = JSON.stringify(gameStateSnapshot)
    // 简单的防乱码 Base64 编码
    const base64Str = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    }));
    
    seedText.value = base64Str
    seedModalMode.value = 'SAVE'
    showSeedModal.value = true
  } catch (e) {
    console.error('生成种子失败:', e)
    alert('生成失败')
  }
}

// 复制种子到剪贴板
const copySeedToClipboard = () => {
  navigator.clipboard.writeText(seedText.value).then(() => {
    alert('种子已复制到剪贴板')
  }).catch(() => {
    alert('复制失败，请手动复制')
  })
}

// 打开加载种子弹窗
const openLoadSeedModal = () => {
  seedText.value = ''
  seedModalMode.value = 'LOAD'
  showSeedModal.value = true
}

// 执行加载种子
const executeLoadSeed = () => {
  if (!seedText.value.trim()) {
    alert('请输入种子代码')
    return
  }
  
  try {
    // 1. 解码验证
    const decodedStr = decodeURIComponent(atob(seedText.value).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const snapshot = JSON.parse(decodedStr)
    
    // 2. 发送给服务器进行全员回溯
    if (store.socket && store.socket.readyState === WebSocket.OPEN) {
      store.socket.send(JSON.stringify({
        action: 'load_game_seed',
        snapshot: snapshot
      }))
      showSeedModal.value = false
    } else {
      alert('WebSocket 未连接，无法加载种子')
    }
  } catch (e) {
    console.error('解析种子失败:', e)
    alert('无效的种子代码，请检查格式是否正确')
  }
}

onUnmounted(() => {
  console.log('[MatchPage] 组件卸载，移除全局游戏事件监听')
  
  // 移除 window 事件监听
  window.removeEventListener('game-socket-message', handleGameEvent)
  
  // 清理定时器
  if (openingCountdownTimer.value) {
    clearInterval(openingCountdownTimer.value)
    openingCountdownTimer.value = null
  }
  if (biddingCountdownTimer.value) {
    clearInterval(biddingCountdownTimer.value)
    biddingCountdownTimer.value = null
  }
})
</script>

<style scoped>
/* 邀请链接弹窗样式（复用 Lobby.vue 的样式） */
.invite-links-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.invite-links-content {
  background: #1a1a1a;
  border: 1px solid rgba(0, 200, 255, 0.3);
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.invite-links-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.invite-links-header .modal-title {
  font-size: 16px;
  color: #ffffff;
  letter-spacing: 2px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.3s ease;
}

.modal-close:hover {
  color: #ffffff;
}

.invite-links-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.invite-link-item-modal {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.invite-link-label-modal {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
}

.invite-link-wrapper-modal {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.5);
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.invite-link-text-modal {
  flex: 1;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Consolas', monospace;
  word-break: break-all;
}

.invite-link-copy-btn-modal {
  padding: 6px 12px;
  background: rgba(0, 200, 255, 0.1);
  border: 1px solid rgba(0, 200, 255, 0.3);
  color: #00C8FF;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.invite-link-copy-btn-modal:hover {
  background: rgba(0, 200, 255, 0.2);
  border-color: #00C8FF;
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

/* 二次确认弹窗 */
.confirm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-modal {
  background: rgba(20, 20, 20, 0.95);
  border: 2px solid #444;
  border-radius: 8px;
  padding: 30px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.8);
}

.modal-header {
  font-size: 24px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 20px;
  text-align: center;
  font-family: 'Rajdhani', sans-serif;
}

.modal-content {
  color: #ccc;
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 30px;
  font-family: 'Noto Sans SC', sans-serif;
}

.modal-content p {
  margin: 10px 0;
}

.modal-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.modal-btn {
  padding: 12px 30px;
  border: 2px solid;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Rajdhani', sans-serif;
}

.modal-btn-cancel {
  background: transparent;
  border-color: #666;
  color: #666;
}

.modal-btn-cancel:hover {
  border-color: #999;
  color: #999;
  background: rgba(255, 255, 255, 0.05);
}

.modal-btn-confirm {
  background: #D50000;
  border-color: #D50000;
  color: #fff;
}

.modal-btn-confirm:hover {
  background: #FF1744;
  border-color: #FF1744;
}

.match-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  background-color: #000000; /* 纯黑背景 */
  overflow: hidden;
  perspective: 1200px; /* 开启全局 3D 透视 */
}

.match-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1; /* 在 HUD 和侧边面板下方 */
}

.modal-tip {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin-bottom: 10px;
}

/* 种子控制台 */
.seed-console {
  position: fixed;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  z-index: 200;
}

.seed-btn {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #444;
  color: #888;
  padding: 8px 16px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  font-family: 'Noto Sans SC', sans-serif;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.seed-btn:hover {
  border-color: #00C8FF;
  color: #00C8FF;
  box-shadow: 0 0 10px rgba(0, 200, 255, 0.3);
  background: rgba(0, 200, 255, 0.1);
}

.seed-btn .icon {
  font-size: 14px;
}

.seed-btn .text {
  letter-spacing: 1px;
}

.seed-textarea {
  width: 100%;
  height: 200px;
  background: #111;
  border: 1px solid #444;
  color: #00E5FF;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  padding: 10px;
  resize: none;
  margin-top: 10px;
  box-sizing: border-box;
}

.seed-textarea:focus {
  outline: none;
  border-color: #00E5FF;
  box-shadow: 0 0 5px rgba(0, 229, 255, 0.3);
}

.seed-textarea:read-only {
  background: #0a0a0a;
  color: #00C8FF;
  cursor: text;
}

.seed-modal-content {
  min-width: 600px;
  max-width: 800px;
}
</style>
