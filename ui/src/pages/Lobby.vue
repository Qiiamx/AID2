<template>
  <div class="lobby-page">
    <!-- 转场组件 -->
    <!-- 顶部栏 -->
    <div class="top-bar">
      <div class="logo">
        <span class="logo-text">联锁博弈</span>
      </div>
    </div>

    <!-- 底部栏 -->
    <div class="bottom-bar">
      <span class="copyright">COPYRIGHT © RHODES ISLAND</span>
      <span class="status">SYSTEM STATUS: ONLINE</span>
    </div>

    <!-- 右上角用户信息 -->
    <div class="user-info-card" @click="handleEditProfileClick">
      <div class="user-info-text">
        <div class="user-label">CURRENT USER</div>
        <div class="user-name">{{ currentUser.nickname || 'Doctor' }}</div>
      </div>
      <div class="user-avatar-small">
        <img v-if="currentUser.avatar" :src="currentUser.avatar" class="avatar-img" alt="头像" />
        <div v-else class="avatar-empty"></div>
      </div>
    </div>

    <!-- 主持人查看邀请链接按钮（仅主持人可见） -->
    <div v-if="isHost" class="invite-link-button-container">
      <button @click="handleInviteLinksClick" class="invite-link-button">
        <span class="button-icon">🔗</span>
        <span class="button-text">再次查看本场比赛邀请链接</span>
      </button>
      
      <!-- 邀请链接弹窗 -->
      <Transition name="fade">
        <div v-if="showInviteLinks" class="invite-links-modal" @click.self="showInviteLinks = false">
          <div class="invite-links-content">
            <div class="invite-links-header">
              <h3 class="modal-title">邀请链接 // INVITE LINKS</h3>
              <button @click="handleCloseInviteLinks" class="modal-close">✕</button>
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
    </div>

    <!-- 主内容区域 -->
    <div class="lobby-content" :class="{ 'counting-down': isCountingDown }">
      <!-- 主持人栏 -->
      <div class="section hosts-section">
        <div class="hosts-list">
          <UserAvatar
            v-for="(user, idx) in hosts"
            :key="user.socketId || idx"
            :index="idx"
            role="HOST"
            size="lg"
            :avatar="user.avatar"
            :nickname="user.nickname"
          />
        </div>
      </div>

      <!-- 队伍A -->
      <div class="section team-section team-a">
        <div class="team-label team-a-label">队伍A // TEAM A</div>
        <div class="team-list">
          <UserAvatar
            v-for="(user, idx) in teamA"
            :key="user.socketId || idx"
            :index="idx"
            role="PLAYER"
            team="A"
            size="md"
            :avatar="user.avatar"
            :nickname="user.nickname"
          />
        </div>
      </div>

      <!-- 队伍B -->
      <div class="section team-section team-b">
        <div class="team-label team-b-label">队伍B // TEAM B</div>
        <div class="team-list">
          <UserAvatar
            v-for="(user, idx) in teamB"
            :key="user.socketId || idx"
            :index="idx"
            role="PLAYER"
            team="B"
            size="md"
            :avatar="user.avatar"
            :nickname="user.nickname"
          />
        </div>
      </div>

      <!-- 控制按钮（仅主持人可见） -->
      <div class="section control-section">
        <AkStartButton
          @click="startCountdown"
          :disabled="!isHost || isCountingDown"
        />
      </div>

      <!-- 观众栏 -->
      <div class="section spectators-section">
        <div class="spectators-label">连接数 // SPECTATORS: {{ spectators.length }}</div>
        <div class="spectators-list">
          <UserAvatar
            v-for="(user, idx) in spectators"
            :key="user.id || idx"
            :index="idx"
            role="SPECTATOR"
            size="sm"
            :avatar="user.avatar"
            :nickname="user.nickname"
          />
        </div>
      </div>
    </div>

    <!-- 编辑个人信息弹窗 -->
    <Transition name="fade">
      <div v-if="showEditProfile" class="edit-modal-overlay" @click.self="showEditProfile = false">
        <div class="edit-modal">
          <h3 class="modal-title">UPDATE PROFILE</h3>
          <div class="modal-content">
            <div class="modal-input-group">
              <label class="modal-label">昵称 // NICKNAME</label>
              <input
                v-model="tempName"
                class="modal-input"
                placeholder="输入新昵称..."
                @keyup.enter="saveProfile"
                maxlength="20"
              />
            </div>
            <div class="modal-input-group">
              <label class="modal-label">头像 // AVATAR</label>
              
              <!-- QQ号获取区域 -->
              <div class="qq-fetch-section">
                <div class="qq-input-wrapper">
                  <input 
                    v-model="qqNumber" 
                    class="modal-input qq-input" 
                    type="text" 
                    placeholder="输入QQ号..." 
                    maxlength="15"
                    @keyup.enter="fetchQQInfo"
                  />
                  <button 
                    class="modal-btn confirm-btn qq-btn" 
                    @click="fetchQQInfo" 
                    :disabled="isFetchingQQ"
                  >
                    {{ isFetchingQQ ? '获取中...' : '获取QQ头像' }}
                  </button>
                </div>
                <div class="qq-tip">输入QQ号可直接导入头像和默认昵称</div>
              </div>
              
              <div class="modal-avatar-upload">
                <input
                  type="file"
                  ref="avatarFileInput"
                  @change="handleAvatarUpload"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  class="avatar-file-input"
                  id="modal-avatar-upload"
                />
                <label for="modal-avatar-upload" class="avatar-upload-button">
                  <span v-if="!tempAvatar">选择图片</span>
                  <span v-else>更换图片</span>
                </label>
                <div v-if="tempAvatar" class="modal-avatar-preview">
                  <img :src="tempAvatar" alt="头像预览" />
                </div>
              </div>
              <div class="avatar-upload-tip">支持 PNG、JPG、GIF、WEBP 格式，最大 5MB</div>
            </div>
          </div>
          <div class="modal-actions">
            <button @click="handleCloseEditProfile" class="modal-btn cancel-btn">CANCEL</button>
            <button @click="saveProfile" class="modal-btn confirm-btn">CONFIRM</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 倒计时遮罩 -->
    <Transition name="scale-in">
      <div v-if="isCountingDown" class="countdown-overlay">
        <div class="countdown-content">
          <div class="countdown-number">{{ countdownValue }}</div>
          <div class="countdown-text">SYSTEM LAUNCHING</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '@/stores/match'
import UserAvatar from '@/components/UserAvatar.vue'
import AkStartButton from '@/components/AkStartButton.vue'
import { playButtonSound, playStartSound } from '@/utils/sound'

const route = useRoute()
const router = useRouter()
const store = useMatchStore()

// 从 App.vue 获取遮罩转场引用
const maskRef = inject('maskRef', null)

// 从路由参数获取房间信息
const userRole = route.query.role || 'HOST'
const userKey = route.query.key || ''

// 转场组件引用（已移除 TransitionWipe，待重新设计转场）
// const transitionRef = ref(null) // 已删除

// 使用Store中的数据
const hosts = computed(() => store.lobbyData.hosts || [])
const teamA = computed(() => store.lobbyData.teamA || [])
const teamB = computed(() => store.lobbyData.teamB || [])
const spectators = computed(() => store.lobbyData.spectators || [])

// 当前用户信息（从store获取）
const currentUser = computed(() => store.myInfo)

// 判断是否是主持人
const isHost = computed(() => store.myInfo.role === 'HOST')

// 状态控制
const showEditProfile = ref(false)
const tempName = ref('')
const tempAvatar = ref('')
const avatarFileInput = ref(null)

// QQ号获取相关
const qqNumber = ref('')
const isFetchingQQ = ref(false)

const isCountingDown = ref(false)
const countdownValue = ref(10)

// 邀请链接相关
const showInviteLinks = ref(false)
const copiedLinkRole = ref('')
const roomInfo = ref({ keys: {} })

// 从 localStorage 读取房间信息
const loadRoomInfo = () => {
  try {
    const saved = localStorage.getItem('roomInfo')
    if (saved) {
      roomInfo.value = JSON.parse(saved)
      console.log('[Lobby] 已加载房间信息:', roomInfo.value)
    }
  } catch (error) {
    console.error('[Lobby] 加载房间信息失败:', error)
  }
}

// 邀请目标列表
const inviteTargets = [
  { role: 'HOST', label: '主持人 // HOST', color: '#FFCD00' },
  { role: 'TEAM_A', label: '队伍A // TEAM A', color: '#00C8FF' },
  { role: 'TEAM_B', label: '队伍B // TEAM B', color: '#FF3333' },
  { role: 'SPECTATOR', label: '观众 // SPECTATOR', color: '#32FF64' }
]

// 生成邀请链接
const getInviteLink = (targetRole) => {
  if (!roomInfo.value || !roomInfo.value.keys || !roomInfo.value.keys[targetRole]) {
    return '链接生成失败，请重试'
  }
  
  const baseUrl = window.location.origin
  const key = roomInfo.value.keys[targetRole]
  
  return `${baseUrl}/?role=${targetRole}&key=${key}`
}

// 复制邀请链接
const copyInviteLink = async (role) => {
  playButtonSound() // 播放按钮音效
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

// 处理头像上传
const handleAvatarUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return

  // 检查文件类型
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
  if (!validTypes.includes(file.type)) {
    alert('不支持的图片格式，请选择 PNG、JPG、GIF 或 WEBP 格式的图片')
    return
  }

  // 检查文件大小（限制为5MB）
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过 5MB')
    return
  }

  // 读取文件并转换为base64
  const reader = new FileReader()
  reader.onload = (e) => {
    tempAvatar.value = e.target.result
    console.log('[Lobby] 头像上传成功')
  }
  reader.onerror = () => {
    alert('图片读取失败，请重试')
  }
  reader.readAsDataURL(file)
}

// 处理编辑资料点击
const handleEditProfileClick = () => {
  playButtonSound() // 播放按钮音效
  showEditProfile.value = true
}

// 处理关闭编辑资料
const handleCloseEditProfile = () => {
  playButtonSound() // 播放按钮音效
  showEditProfile.value = false
  // 清空临时数据
  qqNumber.value = ''
}

// 获取QQ信息
const fetchQQInfo = async () => {
  if (!qqNumber.value.trim()) {
    alert('请输入QQ号')
    return
  }
  
  if (!/^\d+$/.test(qqNumber.value.trim())) {
    alert('QQ号只能包含数字')
    return
  }
  
  isFetchingQQ.value = true
  playButtonSound() // 播放按钮音效
  
  try {
    // 方法1: 直接在前端生成链接（最快，不需要后端代理）
    // QQ头像链接是公开且支持跨域的
    const qq = qqNumber.value.trim()
    const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=640`
    
    // 创建一个 Image 对象来检测图片是否有效
    const img = new Image()
    img.crossOrigin = 'anonymous' // 允许跨域
    
    img.onload = () => {
      // 图片加载成功
      tempAvatar.value = avatarUrl
      // 如果昵称是空的，顺便填个默认的
      if (!tempName.value.trim()) {
        tempName.value = `QQ_${qq}`
      }
      isFetchingQQ.value = false
      console.log('[QQ获取] 头像获取成功:', avatarUrl)
    }
    
    img.onerror = () => {
      // 如果直接加载失败，尝试通过后端API
      console.log('[QQ获取] 直接加载失败，尝试通过后端API')
      fetch(`http://localhost:3000/api/qq/${qq}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            tempAvatar.value = data.avatar
            if (!tempName.value.trim()) {
              tempName.value = data.nickname || `QQ_${qq}`
            }
            isFetchingQQ.value = false
            console.log('[QQ获取] 通过后端API获取成功')
          } else {
            alert('无法获取该QQ号的头像，请检查号码是否正确')
            isFetchingQQ.value = false
          }
        })
        .catch(error => {
          console.error('[QQ获取] 后端API请求失败:', error)
          alert('获取失败，请检查网络连接或QQ号是否正确')
          isFetchingQQ.value = false
        })
    }
    
    img.src = avatarUrl
    
  } catch (error) {
    console.error('[QQ获取] 获取失败:', error)
    alert('获取失败，请重试')
    isFetchingQQ.value = false
  }
}

// 处理邀请链接按钮点击
const handleInviteLinksClick = () => {
  playButtonSound() // 播放按钮音效
  showInviteLinks.value = !showInviteLinks.value
}

// 处理关闭邀请链接弹窗
const handleCloseInviteLinks = () => {
  playButtonSound() // 播放按钮音效
  showInviteLinks.value = false
}

// 保存个人信息
const saveProfile = () => {
  playButtonSound() // 播放按钮音效
  const newNickname = tempName.value.trim()
  const newAvatar = tempAvatar.value
  
  if (!newNickname && !newAvatar) {
    alert('请输入昵称或上传头像')
    return
  }
  
  console.log('[Lobby] 保存个人信息:', { newNickname, newAvatar: newAvatar ? '已上传' : '未上传' })
  console.log('[Lobby] WebSocket状态:', store.socket ? (store.socket.readyState === WebSocket.OPEN ? 'OPEN' : 'NOT_OPEN') : 'NULL')
  
  // 调用Store的方法，发送给服务器
  store.updateProfile(newNickname || undefined, newAvatar || undefined)
  
  showEditProfile.value = false
  tempName.value = ''
  tempAvatar.value = ''
  // 清空文件输入
  if (avatarFileInput.value) {
    avatarFileInput.value.value = ''
  }
}

// 开始倒计时（主持人触发）
const startCountdown = () => {
  if (!isHost.value || isCountingDown.value) return
  
  playStartSound() // 播放 Start match 音效（主持人立即听到）
  console.log('[Lobby] 主持人开始倒计时')
  
  // 发送倒计时开始消息到后端
  if (store.socket && store.socket.readyState === WebSocket.OPEN) {
    const message = {
      action: 'start_countdown'
    }
    store.socket.send(JSON.stringify(message))
    console.log('[Lobby] 已发送倒计时开始消息:', message)
  } else {
    console.warn('[Lobby] WebSocket未连接，无法发送倒计时消息')
    // 如果WebSocket未连接，仍然在本地执行倒计时
    localStartCountdown()
  }
}

// 本地倒计时逻辑（被调用或接收广播后执行）
// 加速倒计时：5秒内从10倒数到0，越来越快
const localStartCountdown = () => {
  if (isCountingDown.value) return // 防止重复启动
  
  playStartSound() // 播放 Start match 音效（所有房间成员都会听到）
  
  isCountingDown.value = true
  countdownValue.value = 10

  const totalDuration = 5000 // 总时长 5 秒
  const startTime = Date.now()
  const startValue = 10
  const endValue = 0
  
  // 加速函数：使用二次函数实现加速效果
  // t 从 0 到 1，返回值也从 0 到 1，但变化速度越来越快
  const accelerationCurve = (t) => {
    // 使用 t^2 实现加速：开始时慢，结束时快
    return t * t
  }
  
  const updateCountdown = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / totalDuration, 1) // 0 到 1
    
    // 应用加速曲线
    const acceleratedProgress = accelerationCurve(progress)
    
    // 计算当前应该显示的数字（从 10 到 0）
    const currentValue = Math.floor(startValue - (startValue - endValue) * acceleratedProgress)
    
    // 确保数字不会小于 0
    countdownValue.value = Math.max(currentValue, 0)
    
    if (progress >= 1) {
      // 倒计时结束
      countdownValue.value = 0
      isCountingDown.value = false
      // 【关键修改】这里不再调用 enterGame()！等待服务器指令！
      console.log('[Lobby] 本地倒计时结束，等待服务器跳转指令...')
    } else {
      // 继续更新（使用 requestAnimationFrame 实现平滑动画）
      requestAnimationFrame(updateCountdown)
    }
  }
  
  // 开始倒计时动画
  updateCountdown()
}

// 进入游戏（转场）
const enterGame = () => {
  console.log('[Lobby] 开始转场到比赛界面')
  
  // 启动遮罩转场
  if (maskRef.value) {
    maskRef.value.start(() => {
      // 遮罩完全覆盖时执行路由跳转
      console.log('[Lobby] 遮罩已覆盖，执行路由跳转')
      router.push({
        path: '/match',
        query: {
          role: route.query.role,
          key: route.query.key,
          nickname: route.query.nickname,
          avatar: route.query.avatar
        }
      })
      console.log('[Lobby] 已跳转到比赛界面')
    })
  } else {
    // 如果遮罩组件未准备好，使用备用方案（直接跳转）
    console.warn('[Lobby] 遮罩组件未准备好，使用备用方案直接跳转')
    router.push({
      path: '/match',
      query: {
        role: route.query.role,
        key: route.query.key,
        nickname: route.query.nickname,
        avatar: route.query.avatar
      }
    })
  }
}

// 【关键修复】将 handleSocketMessage 定义在组件外部，以便在 onUnmounted 中正确移除
let lobbySocketHandler = null

// 【新增】处理中途加入事件（必须在 onMounted 之前定义）
const handleJoinInProgress = () => {
  // 【防重复调用】如果已经在比赛页面，不需要转场
  if (route.path === '/match') {
    console.log('[Lobby] 已在比赛页面，跳过转场')
    return
  }
  
  console.log('[Lobby] 检测到比赛进行中，立即入场！')
  // 直接跳转，不需要倒计时
  // 使用遮罩转场体验更好
  if (maskRef.value) {
    const transitionStarted = maskRef.value.start(() => {
      router.push({
        path: '/match',
        query: {
          role: route.query.role,
          key: route.query.key,
          nickname: route.query.nickname,
          avatar: route.query.avatar
        }
      })
      console.log('[Lobby] 已跳转到比赛界面（中途加入）')
    })
    
    // 【关键修复】如果转场被忽略（返回 false），使用备用方案直接跳转
    if (transitionStarted === false) {
      console.log('[Lobby] 转场被忽略，使用备用方案直接跳转')
      router.push({
        path: '/match',
        query: {
          role: route.query.role,
          key: route.query.key,
          nickname: route.query.nickname,
          avatar: route.query.avatar
        }
      })
      console.log('[Lobby] 已跳转到比赛界面（中途加入，备用方案）')
    }
  } else {
    // 如果遮罩组件未准备好，使用备用方案（直接跳转）
    router.push({
      path: '/match',
      query: {
        role: route.query.role,
        key: route.query.key,
        nickname: route.query.nickname,
        avatar: route.query.avatar
      }
    })
    console.log('[Lobby] 已跳转到比赛界面（中途加入，备用方案）')
  }
}

// 【新增】处理服务端强制跳转指令（必须在 onMounted 之前定义，以便在 onUnmounted 中移除）
const handleEnterMatchTrigger = (event) => {
  console.log('[Lobby] 收到服务端跳转指令，执行转场', event.detail)
  enterGame() // 只有收到这个指令才跳转
}

onMounted(() => {
  // 加载房间信息（用于显示邀请链接）
  loadRoomInfo()
  
  // 初始化编辑弹窗的临时值
  tempName.value = store.myInfo.nickname
  tempAvatar.value = store.myInfo.avatar
  
  // 页面加载时不需要转场，直接显示大厅内容
  // （转场已经在 hello-page.vue 中完成）
  
  // 如果还没有加入大厅，则加入（从路由参数获取信息）
  // 【关键修复】只有当 socket 未连接时才尝试加入，防止重复连接
  if (userKey && userRole && (!store.socket || store.socket.readyState !== WebSocket.OPEN)) {
    const nickname = route.query.nickname || (userRole === 'HOST' ? 'Host' : `Doctor${Math.floor(Math.random() * 1000)}`)
    const avatar = route.query.avatar || ''
    
    console.log('[Lobby] 准备加入大厅:', { userKey, userRole, nickname, avatar })
    console.log('[Lobby] 当前store状态:', {
      lobbyData: store.lobbyData,
      myInfo: store.myInfo,
      socket: store.socket ? (store.socket.readyState === WebSocket.OPEN ? 'OPEN' : 'NOT_OPEN') : 'NULL'
    })
    
    store.joinLobby(userRole, userKey, nickname, avatar)
    
    // 延迟一下再检查数据
    setTimeout(() => {
      console.log('[Lobby] 加入后store状态:', {
        lobbyData: store.lobbyData,
        myInfo: store.myInfo
      })
    }, 2000)
  }

  // 监听WebSocket消息（倒计时等）
  // 定义消息处理函数（已在组件外部定义，以便在 onUnmounted 中移除）
  lobbySocketHandler = (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('[Lobby] 收到WebSocket消息:', data)
      
      // 处理倒计时开始消息
      // 后端广播的格式是 {type: 'start_countdown'}
      // 忽略自己发送的原始消息（{action: 'start_countdown'}）
      if (data.type === 'start_countdown') {
        console.log('[Lobby] 收到倒计时开始广播，开始本地倒计时')
        localStartCountdown()
      }
      
      // 如果收到的是自己发送的原始消息，说明后端可能没有处理，直接忽略
      // 因为后端应该将其转换为 {type: 'start_countdown'} 并广播
    } catch (error) {
      console.error('[Lobby] 解析WebSocket消息失败:', error)
    }
  }

  // 如果WebSocket已连接，添加消息监听
  if (store.socket) {
    store.socket.addEventListener('message', lobbySocketHandler)
    console.log('[Lobby] 已添加WebSocket消息监听')
  } else {
    // 如果WebSocket还未连接，等待连接后再添加监听
    const checkSocket = setInterval(() => {
      if (store.socket) {
        store.socket.addEventListener('message', lobbySocketHandler)
        console.log('[Lobby] WebSocket已连接，已添加消息监听')
        clearInterval(checkSocket)
      }
    }, 500)
    
    // 10秒后停止检查
    setTimeout(() => {
      clearInterval(checkSocket)
    }, 10000)
  }
  
  // 【新增】监听中途加入事件
  window.addEventListener('join-in-progress-trigger', handleJoinInProgress)
  console.log('[Lobby] 已添加中途加入事件监听')
  
  // 【关键修复】主动检查 Store 状态，防止错过事件（解决时序问题）
  // 如果组件加载时，Store 已经收到了中途加入消息，立即触发跳转
  if (store.isJoinInProgress) {
    console.log('[Lobby] 发现由于时序问题暂存的中途加入请求，立即执行跳转')
    handleJoinInProgress()
  }
  
  // 【新增】监听服务端强制跳转指令
  window.addEventListener('enter-match-trigger', handleEnterMatchTrigger)
  console.log('[Lobby] 已添加服务端跳转指令监听')
})

onUnmounted(() => {
  console.log('[Lobby] 组件卸载，移除WebSocket消息监听')
  
  // 【关键修复】移除监听器，防止跳到 MatchPage 后还在打印日志
  if (store.socket && lobbySocketHandler) {
    try {
      store.socket.removeEventListener('message', lobbySocketHandler)
      console.log('[Lobby] 已移除WebSocket消息监听')
      lobbySocketHandler = null // 清空引用
    } catch (error) {
      console.error('[Lobby] 移除监听器失败:', error)
    }
  }
  
  // 【新增】移除中途加入事件监听
  window.removeEventListener('join-in-progress-trigger', handleJoinInProgress)
  
  // 【新增】移除服务端跳转指令监听
  window.removeEventListener('enter-match-trigger', handleEnterMatchTrigger)
})
</script>

<style scoped>
.lobby-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  background-color: #121212;
  overflow: hidden;
  font-family: 'Microsoft YaHei', 'SimHei', 'Arial', sans-serif;
  user-select: none;
  display: flex;
  flex-direction: column;
}

/* 顶部栏 */
.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 64px;
  background-color: #000000;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 0 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative; /* 为阶段指示器提供定位锚点 */
}

.logo-text {
  color: #ffffff;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 4px;
}

/* 底部栏 */
.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 48px;
  background-color: #000000;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Arial', 'Consolas', monospace;
  letter-spacing: 1px;
}

/* 右上角用户信息 */
.user-info-card {
  position: fixed;
  top: 80px;
  right: 32px;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.5);
  padding: 8px 16px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  clip-path: polygon(0 0, 100% 0, 100% 70%, 90% 100%, 0 100%);
}

.user-info-card:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.7);
}

.user-info-text {
  text-align: right;
}

.user-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Arial', 'Consolas', monospace;
  letter-spacing: 1px;
  transition: color 0.3s ease;
}

.user-info-card:hover .user-label {
  color: #00C8FF;
}

.user-name {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 2px;
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
}

.user-avatar-small {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-empty {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.1);
}

/* 主内容区域 */
.lobby-content {
  position: absolute;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 48px;
  padding: 48px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  overflow-y: auto;
  transition: all 1s ease;
}

.lobby-content.counting-down {
  filter: grayscale(100%) blur(4px);
  transform: scale(0.95);
}

.section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 主持人栏 */
.hosts-section {
  margin-bottom: 16px;
}

.hosts-list {
  display: flex;
  gap: 48px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 队伍栏 */
.team-section {
  margin-bottom: 24px;
}

.team-label {
  font-size: 12px;
  letter-spacing: 8px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  font-weight: 500;
  border-bottom: 1px solid;
}

.team-a-label {
  color: #00C8FF;
  border-bottom-color: rgba(0, 200, 255, 0.3);
}

.team-b-label {
  color: #FF3333;
  border-bottom-color: rgba(255, 51, 51, 0.3);
}

.team-list {
  display: flex;
  gap: 32px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 控制按钮 */
.control-section {
  margin: 24px 0;
}

.control-btn {
  width: 256px;
  height: 64px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  margin: 0 16px;
}

.start-btn {
  background: #00C8FF;
  color: #000000;
  border: none;
}

.start-btn:hover:not(.disabled) {
  background: #ffffff;
  box-shadow: 0 0 20px rgba(0, 200, 255, 0.6);
}


.control-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.3);
}

.btn-main-text {
  font-size: 20px;
  font-weight: 700;
  font-style: italic;
  letter-spacing: 2px;
}

.btn-sub-text {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 1px;
}

/* 观众栏 */
.spectators-section {
  width: 100%;
  padding: 0 80px;
}

.spectators-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  margin-bottom: 16px;
  font-family: 'Arial', 'Consolas', monospace;
  letter-spacing: 2px;
}

.spectators-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  max-height: 128px;
  overflow-y: auto;
  padding-right: 8px;
}

.spectators-list::-webkit-scrollbar {
  width: 4px;
}

.spectators-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

/* 编辑弹窗 */
.edit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.edit-modal {
  background: #1a1a1a;
  border-left: 4px solid #00C8FF;
  padding: 32px;
  width: 384px;
  position: relative;
}

/* 编辑弹窗标题 */
.edit-modal .modal-title {
  font-size: 20px;
  color: #ffffff;
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 24px;
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.modal-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 2px;
  font-weight: 500;
}

.modal-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 12px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s ease;
}

.modal-input:focus {
  border-color: #00C8FF;
}

.modal-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.modal-avatar-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-avatar-upload .avatar-file-input {
  display: none;
}

.modal-avatar-upload .avatar-upload-button {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.modal-avatar-upload .avatar-upload-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #00C8FF;
  color: #00C8FF;
}

.modal-avatar-preview {
  width: 48px;
  height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  overflow: hidden;
  flex-shrink: 0;
}

.modal-avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-upload-tip {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
  letter-spacing: 1px;
}

/* QQ获取区域样式 */
.qq-fetch-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
}

.qq-input-wrapper {
  display: flex;
  gap: 10px;
  align-items: center;
}

.qq-input {
  flex: 1;
  font-family: 'Consolas', monospace;
}

.qq-btn {
  white-space: nowrap;
  padding: 0 15px;
  font-size: 12px;
  height: 42px; /* 与输入框等高 */
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
}

.qq-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qq-tip {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 6px;
  letter-spacing: 1px;
}

.modal-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
}

/* 邀请链接按钮 */
.invite-link-button-container {
  position: fixed;
  right: 20px;
  top: 150px; /* 下移，避免与用户信息卡片重叠 */
  z-index: 50;
}

.invite-link-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(0, 200, 255, 0.1);
  border: 1px solid rgba(0, 200, 255, 0.3);
  color: #00C8FF;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 1px;
}

.invite-link-button:hover {
  background: rgba(0, 200, 255, 0.2);
  border-color: #00C8FF;
  box-shadow: 0 0 10px rgba(0, 200, 255, 0.3);
}

.button-icon {
  font-size: 14px;
}

/* 邀请链接弹窗 */
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

/* 邀请链接弹窗标题 */
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

.cancel-btn {
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
}

.cancel-btn:hover {
  color: #ffffff;
}

.confirm-btn {
  background: #00C8FF;
  color: #000000;
  font-weight: 700;
}

.confirm-btn:hover {
  background: #ffffff;
}

/* 倒计时遮罩 */
.countdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  pointer-events: none;
}

.countdown-content {
  position: relative;
  text-align: center;
}

.countdown-number {
  font-size: 200px;
  font-weight: 900;
  color: #2a2a2a;
  line-height: 1;
  font-family: 'Arial', 'Consolas', monospace;
  text-shadow: 4px 4px 0px #1a1a1a, 8px 8px 20px rgba(0, 0, 0, 0.8);
  animation: pulse-fast 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.countdown-text {
  margin-top: 40px;
  font-size: 24px;
  color: #ffffff;
  letter-spacing: 16px;
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  font-weight: 500;
}

@keyframes pulse-fast {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-in-enter-active {
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.scale-in-enter-from {
  transform: scale(0);
  opacity: 0;
}

.scale-in-leave-active {
  transition: all 0.3s ease-in;
}

.scale-in-leave-to {
  transform: scale(0);
  opacity: 0;
}

/* 转场统一使用 TransitionWipe 组件，移除自定义转场样式 */
</style>

