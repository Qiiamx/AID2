<template>
  <div class="home-page">
    
    <!-- 身份内容层（底层，始终存在） -->
    <div class="identity-layer">
      <!-- 科技背景（仅在身份确认页面显示） -->
      <TechBackground v-if="hasEntered && selectedRole" :theme="userTheme" />
      
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

      <!-- 动态背景 -->
      <div class="background-container">
        <Transition name="fade-slow">
          <img
            :key="currentBgIndex"
            :src="bgList[currentBgIndex]"
            class="background-image"
            :style="randomMovementStyle"
            alt="Background"
          />
        </Transition>
      </div>

      <!-- 自动模式通知条 -->
      <div v-if="isAutoMode && hasEntered" class="auto-mode-notice" :class="{ 'slide-in': showAutoNotice }">
        <div class="notice-indicator"></div>
        <span class="notice-text" :class="{ 'text-slide-in': showAutoNotice }">
          身份已自动匹配 // {{ autoModeRoleText }} // IDENTITY DETECTED
        </span>
      </div>

      <!-- 身份选择内容 -->
      <div class="identity-content">
        <!-- 标题 -->
        <h2 v-if="!selectedRole && !isAutoMode" class="identity-title">请选择你的身份</h2>

        <!-- 按钮容器 -->
        <div class="role-buttons-container">
          <button
            v-for="(role, index) in roles"
            :key="role.key"
            @click="!isAutoMode && role.key !== 'HOST' && !selectedRole ? null : handleRoleSelect(role.key)"
            :disabled="!!selectedRole || (isAutoMode && selectedRole !== role.key) || (!isAutoMode && role.key !== 'HOST' && !selectedRole)"
            class="role-btn"
            :class="[
              `role-${role.key.toLowerCase()}`,
              {
                'selected': selectedRole === role.key,
                'hidden': selectedRole && selectedRole !== role.key,
                'locked': !isAutoMode && role.key !== 'HOST' && !selectedRole
              }
            ]"
            :style="getButtonStyle(index, role.key)"
          >
            <div class="btn-inner">
              <!-- 锁定遮罩层 -->
              <div v-if="!isAutoMode && role.key !== 'HOST' && !selectedRole" class="lock-overlay">
                <div class="lock-icon-large">🔒</div>
              </div>
              <div class="icon-container" :class="`icon-${role.key.toLowerCase()}`">
                <img :src="role.icon" class="role-icon-image" :alt="role.label" />
              </div>
              <span class="role-name">{{ role.label }}</span>
              <span class="role-subtitle">{{ role.sub }}</span>
            </div>
          </button>
        </div>

        <!-- 右侧面板 -->
        <div v-if="selectedRole" class="right-panel">
            <!-- 主持人面板 -->
            <div v-if="selectedRole === 'HOST' && !isAutoMode" class="panel-content">
              <p class="panel-text">请确认链接，并将其分享给选手和观众：</p>
              
              <!-- 邀请链接列表 -->
              <div class="invite-links-container">
                <div v-if="hostLoading" class="invite-link-loading">
                  <div class="loading-spinner-small"></div>
                  <span>正在连接卫星，生成邀请链接...</span>
                </div>
                <div v-else v-for="target in inviteTargets" :key="target.role" class="invite-link-item">
                  <div class="invite-link-label" :style="{ color: target.color }">
                    {{ target.label }}
                  </div>
                  <div class="invite-link-wrapper">
                    <span class="invite-link-text">{{ getInviteLink(target.role) }}</span>
                    <button 
                      @click="copyInviteLink(target.role)" 
                      class="invite-link-copy-btn"
                      :disabled="hostLoading || !roomInfo.keys[target.role]"
                    >
                      {{ copiedLinkRole === target.role ? '已复制' : '复制' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- 个人信息设置区域 -->
              <div class="profile-section">
                <div class="profile-input-group">
                  <label class="profile-label">昵称 // NICKNAME (必填)</label>
                  <input
                    type="text"
                    v-model="userNickname"
                    placeholder="输入昵称..."
                    class="profile-input"
                    maxlength="20"
                  />
                  <div v-if="!userNickname.trim()" class="nickname-required-tip">* 昵称不能为空</div>
                </div>
                
                <div class="profile-input-group">
                  <label class="profile-label">头像 // AVATAR (必填)</label>
                  
                  <!-- QQ号获取区域 -->
                  <div class="qq-fetch-section">
                    <div class="qq-input-wrapper">
                      <input 
                        v-model="qqNumber" 
                        class="profile-input qq-input" 
                        type="text" 
                        placeholder="输入QQ号..." 
                        maxlength="15"
                        @keyup.enter="fetchQQInfo"
                      />
                      <button 
                        class="qq-btn" 
                        @click="fetchQQInfo" 
                        :disabled="isFetchingQQ"
                      >
                        {{ isFetchingQQ ? '获取中...' : '获取QQ头像' }}
                      </button>
                    </div>
                    <div class="qq-tip">输入QQ号可直接导入头像和默认昵称</div>
                  </div>
                  
                  <div class="avatar-upload-wrapper">
                    <input
                      type="file"
                      :ref="selectedRole === 'HOST' ? 'avatarInputHost' : 'avatarInputPlayer'"
                      @change="handleAvatarUpload"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      class="avatar-file-input"
                      :id="selectedRole === 'HOST' ? 'avatar-upload-host' : (selectedRole === 'TEAM_A' ? 'avatar-upload-team-a' : 'avatar-upload-team-b')"
                    />
                    <label :for="selectedRole === 'HOST' ? 'avatar-upload-host' : (selectedRole === 'TEAM_A' ? 'avatar-upload-team-a' : 'avatar-upload-team-b')" class="avatar-upload-button">
                      <span v-if="!userAvatar">选择图片</span>
                      <span v-else>更换图片</span>
                    </label>
                    <!-- 头像预览 -->
                    <div class="avatar-preview" :class="{ 'has-avatar': userAvatar }" @click="useDefaultAvatar" style="cursor: pointer;">
                      <img v-if="userAvatar" :src="userAvatar" class="avatar-image" alt="头像" />
                      <div v-else class="avatar-placeholder">NO<br>DATA</div>
                      <div v-if="userAvatar" class="avatar-corner"></div>
                    </div>
                  </div>
                  <div v-if="!userAvatar" class="avatar-required-tip">* 必须上传头像或选择默认头像</div>
                  <div v-else class="avatar-upload-tip">支持 PNG、JPG、GIF、WEBP 格式，最大 5MB，或点击头像选择默认头像</div>
                </div>
              </div>

              <button 
                @click="handleHostConfirm" 
                :disabled="hostLoading || !userNickname.trim() || !userAvatar"
                class="confirm-button confirm-button-blue host-confirm-btn"
                :class="{ 'loading': hostLoading }"
              >
                <div v-if="!hostLoading" class="button-content">
                  <span class="button-prefix">CONFIRM</span>
                  <span>我已确认完毕，进入比赛大厅</span>
                </div>
                <div v-else class="button-content loading-content">
                  <svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="loading-text">INITIALIZING...</span>
                </div>
                <div v-if="hostLoading" class="loading-progress-bar"></div>
              </button>
            </div>

            <!-- 队伍A/B/观众面板 -->
            <div v-else class="panel-content">
              <div class="registration-header">
                <div class="registration-title">PROFILE REGISTRATION</div>
                <div class="registration-subtitle">为了确保通讯安全，请完善您的干员档案</div>
              </div>

              <div class="profile-form-container">
                <!-- 代号输入区域（最上方） -->
                <div class="nickname-registration-group">
                  <label class="nickname-label">代号 // CODENAME (必填)</label>
                  <input
                    type="text"
                    v-model="userNickname"
                    maxlength="12"
                    placeholder="请输入您的代号"
                    class="nickname-input"
                    @keyup.enter="canJoin ? handlePlayerJoin() : null"
                  />
                  <div v-if="!userNickname.trim()" class="nickname-required-tip">* 代号不能为空</div>
                </div>

                <!-- 头像相关区域 -->
                <div class="avatar-registration-group">
                  <!-- QQ号获取区域（放在头像上方） -->
                  <div class="qq-fetch-section-registration">
                    <div class="qq-input-wrapper-registration">
                      <input 
                        v-model="qqNumber" 
                        class="qq-input-registration" 
                        type="text" 
                        placeholder="输入QQ号..." 
                        maxlength="15"
                        @keyup.enter="fetchQQInfo"
                      />
                      <button 
                        class="qq-btn-registration" 
                        @click="fetchQQInfo" 
                        :disabled="isFetchingQQ"
                      >
                        {{ isFetchingQQ ? '获取中...' : '获取QQ头像' }}
                      </button>
                    </div>
                    <div class="qq-tip-registration">输入QQ号可直接导入头像和默认代号</div>
                  </div>
                  
                  <!-- 头像预览 -->
                  <div class="avatar-preview-large" :class="{ 'has-avatar': userAvatar }" @click="useDefaultAvatar">
                    <img v-if="userAvatar" :src="userAvatar" class="avatar-image-large" alt="头像" />
                    <div v-else class="avatar-placeholder-large">AVATAR<br>REQUIRED</div>
                    <div v-if="userAvatar" class="avatar-corner-large"></div>
                    <div class="default-avatar-overlay">选择默认头像</div>
                  </div>
                  
                  <!-- 头像必填提示 -->
                  <div v-if="!userAvatar" class="avatar-required-tip">* 必须上传头像</div>
                  
                  <!-- 选择图片按钮 -->
                  <div class="avatar-upload-section">
                    <input
                      type="file"
                      :ref="avatarInputPlayer"
                      @change="handleAvatarUpload"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      class="avatar-file-input"
                      :id="selectedRole === 'TEAM_A' ? 'avatar-upload-team-a' : (selectedRole === 'TEAM_B' ? 'avatar-upload-team-b' : 'avatar-upload-spectator')"
                    />
                    <label :for="selectedRole === 'TEAM_A' ? 'avatar-upload-team-a' : (selectedRole === 'TEAM_B' ? 'avatar-upload-team-b' : 'avatar-upload-spectator')" class="avatar-upload-button-large">
                      <span v-if="!userAvatar">选择图片</span>
                      <span v-else>更换图片</span>
                    </label>
                  </div>
                </div>
              </div>

              <button
                @click="handlePlayerJoin"
                :disabled="!canJoin || isJoining || joinSuccess"
                class="confirm-button player-join-btn"
                :class="playerButtonClass"
              >
                <span v-if="!isJoining && !joinSuccess" class="button-content">
                  <span class="button-prefix">确认接入 // CONFIRM ACCESS</span>
                </span>
                <span v-if="isJoining" class="button-content loading-content">
                  <svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="loading-text">ESTABLISHING CONNECTION...</span>
                </span>
                <span v-if="joinSuccess" class="button-content success-content">
                  <span class="success-icon">✓</span>
                  <span>已成功接入！请稍后......</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>


    <!-- 入口层（顶层，使用 clip-path 实现揭示效果） -->
    <div
      v-if="!hasEntered"
      class="entry-overlay-container"
      :style="entryOverlayStyle"
    >
      <!-- 粒子特效 -->
      <InteractiveParticles :dispersed="isTransitioning" />
      
        <div class="entry-content">
        <!-- 顶部栏 -->
        <div class="top-bar">
          <div class="logo">
            <span class="logo-text">联锁博弈</span>
          </div>
        </div>

        <!-- 按钮包裹层，确保按钮在粒子上面 -->
        <div class="entry-btn-wrapper">
          <button
            @click="startSlitScan"
            class="create-button"
            :class="{ 'clicked': isTransitioning }"
          >
            <span class="button-text">{{ isAutoMode ? '进入比赛现场' : '创建比赛' }}</span>
            <div class="button-shine"></div>
          </button>
        </div>

        <!-- 底部栏 -->
        <div class="bottom-bar">
          <span class="copyright">COPYRIGHT © RHODES ISLAND</span>
          <span class="status">SYSTEM STATUS: WAITING</span>
        </div>
      </div>
    </div>

    <!-- 分割线（必须在容器外，避免被 clip-path 切掉） -->
    <div
      v-if="isTransitioning"
      class="slit-line"
      :style="{ right: transitionProgress + '%' }"
    >
      <div class="line-core"></div>
      <div class="line-glow"></div>
    </div>

    <!-- 头像选择弹窗 -->
    <div v-if="showAvatarModal" class="avatar-modal-overlay" @click.self="showAvatarModal = false">
        <div class="avatar-modal-container">
          <div class="avatar-modal-header">
            <h3 class="avatar-modal-title">选择预设头像 // SELECT AVATAR</h3>
            <button @click="showAvatarModal = false" class="avatar-modal-close">✕ CLOSE</button>
          </div>
          <div class="avatar-modal-grid">
            <div
              v-for="i in 30"
              :key="i"
              @click="selectAvatar(i)"
              class="avatar-modal-item"
              :class="{ 'selected': userAvatar === `/images/${i}.png` }"
            >
              <img :src="`/images/${i}.png`" :alt="`Avatar ${i}`" class="avatar-modal-image" />
              <div v-if="userAvatar === `/images/${i}.png`" class="avatar-modal-check">✓</div>
            </div>
          </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMatchStore } from '@/stores/match'
import InteractiveParticles from '@/components/InteractiveParticles.vue'
import TechBackground from '@/components/TechBackground.vue'
import { playButtonSound } from '@/utils/sound'

// 角色配置
const roles = [
  { key: 'HOST', label: '主持人', sub: 'HOST / OWNER', color: '#FFCD00', icon: '/images/主持人.png' },
  { key: 'TEAM_A', label: '队伍 A', sub: 'TEAM ALPHA', color: '#00C8FF', icon: '/images/队伍A.png' },
  { key: 'TEAM_B', label: '队伍 B', sub: 'TEAM BETA', color: '#FF3333', icon: '/images/队伍B.png' },
  { key: 'SPECTATOR', label: '观众', sub: 'SPECTATOR', color: '#32FF64', icon: '/images/观众.png' }
]

const router = useRouter()
const route = useRoute()
const store = useMatchStore()

// 从 App.vue 获取遮罩转场引用
const maskRef = inject('maskRef', null)

// 计算背景主题色
const userTheme = computed(() => {
  if (!selectedRole.value) return 'blue' // 默认蓝色
  
  if (selectedRole.value === 'HOST') return 'gold'
  if (selectedRole.value === 'TEAM_A') return 'blue'
  if (selectedRole.value === 'TEAM_B') return 'red'
  return 'blue' // SPECTATOR 或其他默认蓝色
})

// 状态管理
const isTransitioning = ref(false)
const hasEntered = ref(false) // 是否已点击入口按钮
const transitionProgress = ref(0) // 入口转场进度 0% -> 100%
const selectedRole = ref(null)
const isJoining = ref(false)
const showAvatarModal = ref(false) // 控制头像选择弹窗

// 主持人加载状态
const hostLoading = ref(false)

// 选手/观众状态
const joinSuccess = ref(false)

// 用户信息状态
const userNickname = ref('')
const userAvatar = ref('')
const avatarInputHost = ref(null)
const avatarInputPlayer = ref(null)

// QQ号获取相关
const qqNumber = ref('')
const isFetchingQQ = ref(false)

// 自动模式状态
const isAutoMode = ref(false)
const autoModeRoleText = ref('')
const showAutoNotice = ref(false) // 控制通知条滑入动画

// 房间信息
const roomInfo = ref({ keys: {} })

// 邀请链接目标
const inviteTargets = [
  { role: 'HOST', label: '主持人', color: '#FFCD00' },
  { role: 'TEAM_A', label: 'A队选手', color: '#00C8FF' },
  { role: 'TEAM_B', label: 'B队选手', color: '#FF3333' },
  { role: 'SPECTATOR', label: '观众', color: '#32FF64' }
]

// 复制链接状态
const copiedLinkRole = ref('')

// 计算是否可以加入（昵称和头像必填）
const canJoin = computed(() => {
  return userNickname.value.trim().length > 0 && userAvatar.value.length > 0
})

// 背景图片列表
const getBgImage = (index) => {
  try {
    return new URL(`../assets/bg/bg${index + 1}.png`, import.meta.url).href
  } catch {
    return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxMTExMTEiLz48L3N2Zz4=`
  }
}

const bgList = ref([
  getBgImage(0),
  getBgImage(1),
  getBgImage(2)
])

const currentBgIndex = ref(0)
const moveDirection = ref({ x: 0, y: 0 })

// 计算随机移动样式
const randomMovementStyle = computed(() => {
  return {
    transform: `scale(1.3) translate(${moveDirection.value.x}px, ${moveDirection.value.y}px)`,
    opacity: 0.35
  }
})

// 遮罩层样式（已移除 clip-path 转场，改用 TransitionWipe 组件处理转场）
// maskStyle 不再需要，转场由 TransitionWipe 组件统一处理

// 计算按钮样式（实现放大和平移动画）
const getButtonStyle = (index, roleKey) => {
  if (!selectedRole.value) {
    // 未选中状态：居中排列
    const centerOffset = (index - 1.5) * 240 // 240 = 按钮宽度(192) + 间距(48)
    return {
      transform: `translateX(${centerOffset}px) scale(1)`,
      left: '50%',
      marginLeft: '-96px' // 按钮宽度的一半
    }
  }

  if (selectedRole.value === roleKey) {
    // 选中状态：放大150%，移动到左侧，整体居中
    return {
      transform: 'translateX(0) scale(1.5)',
      left: 'calc(50% - 400px)', // 整体居中，按钮在左侧
      marginLeft: '0'
    }
  }

  // 其他按钮：保持原位（由CSS控制淡出）
  const centerOffset = (index - 1.5) * 240
  return {
    transform: `translateX(${centerOffset}px) scale(1)`,
    left: '50%',
    marginLeft: '-96px'
  }
}

// 处理角色选择
const handleRoleSelect = async (key) => {
  // 如果是自动模式，禁止手动切换
  if (isAutoMode.value) {
    return
  }
  
  // 如果是手动模式，且点的不是主持人 -> 显示提示并返回
  if (key !== 'HOST') {
    alert('⛔ 访问受限：队伍成员及观众仅能通过【邀请链接】加入。\n请联系主持人获取专属链接。')
    return
  }
  
  selectedRole.value = key
  if (key === 'HOST') {
    // 先显示加载状态，防止用户看到空的链接
    hostLoading.value = true
    console.log('[HelloPage] 正在请求后端创建房间...')
    
    // 创建房间并获取邀请链接
    await createRoom()
    
    // createRoom 内部会处理 hostLoading.value = false
  }
}

// 创建房间（主持人）
const createRoom = async () => {
  try {
    const apiUrl = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:3000/api/create-room'
      : `${location.protocol}//${location.host}/api/create-room`
    
    console.log('[HelloPage] 发送创建房间请求到:', apiUrl)
    
    const response = await fetch(apiUrl, {
        method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('[HelloPage] 收到后端响应:', data)
    
    // 后端返回格式: { success: true, keys: {...} }
    if (data.success) {
      if (!data.keys) {
        throw new Error('后端返回数据格式不正确')
      }
      
      roomInfo.value = {
        keys: data.keys
      }
      console.log('[HelloPage] 房间创建成功，房间信息已更新:', roomInfo.value)
      hostLoading.value = false // 数据有了，取消加载状态
    } else {
      console.error('[HelloPage] 创建房间失败，后端返回:', data)
      alert('创建房间失败: ' + (data.message || '未知错误'))
      hostLoading.value = false // 失败也要取消加载状态
    }
  } catch (error) {
    console.error('[HelloPage] 创建房间请求失败:', error)
    alert('创建房间失败，请检查网络连接: ' + error.message)
    hostLoading.value = false // 异常也要取消加载状态
  }
}

  // 生成邀请链接
const getInviteLink = (targetRole) => {
  // 如果还在加载，显示提示
  if (hostLoading.value) {
    return '正在生成链接...'
  }
  
  // 检查数据是否完整
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

// 显示头像选择弹窗
const useDefaultAvatar = () => {
  playButtonSound() // 播放按钮音效
  showAvatarModal.value = true
}

// 选择头像
const selectAvatar = (index) => {
  playButtonSound() // 播放按钮音效
  userAvatar.value = `/images/${index}.png`
  showAvatarModal.value = false
  console.log('[HelloPage] 选择默认头像:', `/images/${index}.png`)
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
    userAvatar.value = e.target.result
    console.log('[Avatar] 头像上传成功')
  }
  reader.onerror = () => {
    alert('图片读取失败，请重试')
  }
  reader.readAsDataURL(file)
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
      userAvatar.value = avatarUrl
      // 如果昵称是空的，顺便填个默认的
      if (!userNickname.value.trim()) {
        userNickname.value = `QQ_${qq}`
      }
      isFetchingQQ.value = false
      console.log('[QQ获取] 头像获取成功:', avatarUrl)
    }
    
    img.onerror = () => {
      // 如果直接加载失败，尝试通过后端API
      console.log('[QQ获取] 直接加载失败，尝试通过后端API')
      const apiUrl = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? `http://localhost:3000/api/qq/${qq}`
        : `${location.protocol}//${location.host}/api/qq/${qq}`
      
      fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            userAvatar.value = data.avatar
            if (!userNickname.value.trim()) {
              userNickname.value = data.nickname || `QQ_${qq}`
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

// 主持人确认（细化按钮表现）
const handleHostConfirm = () => {
  if (hostLoading.value) return
  
  // 验证昵称和头像是否已填写
  if (!userNickname.value.trim()) {
    alert('请输入昵称')
    return
  }
  if (!userAvatar.value) {
    alert('请上传头像或选择默认头像')
    return
  }
  
  hostLoading.value = true
  
  // 模拟按钮加载进度（3秒，在98%时触发遮罩转场）
  let progress = 0
  const progressInterval = setInterval(() => {
    progress += 1
    
    // 在98%时触发遮罩转场
    if (progress >= 98) {
      clearInterval(progressInterval)
      
      const role = 'HOST'
      const key = roomInfo.value.keys?.HOST || null
      const nickname = userNickname.value.trim()
      const avatar = userAvatar.value
      
      console.log('[HelloPage] 按钮进度98%，启动遮罩转场')
      console.log('[HelloPage] 主持人创建房间:', { role, key, nickname, avatar })
      
      // 启动遮罩转场
      if (maskRef.value) {
        let transitionCompleted = false
        const transitionTimeout = setTimeout(() => {
          if (!transitionCompleted) {
            console.error('[HelloPage] 遮罩转场超时，使用备用方案')
            transitionCompleted = true
            // 备用方案：直接跳转
            if (roomInfo.value && roomInfo.value.keys) {
              localStorage.setItem('roomInfo', JSON.stringify(roomInfo.value))
            }
            if (key) {
              store.joinLobbyWithKey(role, key, nickname, avatar)
            }else{
              router.push({
                path: '/lobby',
                query: {
                  role: role,
                  key: key,
                  nickname: nickname,
                  avatar: avatar
                }
              })
              return 
            }
            hostLoading.value = false
          }
        }, 5000) // 5秒超时
        
        maskRef.value.start(() => {
          if (transitionCompleted) return
          transitionCompleted = true
          clearTimeout(transitionTimeout)
          
          // 遮罩完全覆盖时执行
          // 调用Store加入大厅（使用key）
          if (key) {
            store.joinLobbyWithKey(role, key, nickname, avatar)
          } else {
            console.error('[HelloPage] 缺少key，无法加入大厅')
            hostLoading.value = false
            return
          }
          
          // 将房间信息保存到 localStorage
          if (roomInfo.value && roomInfo.value.keys) {
            localStorage.setItem('roomInfo', JSON.stringify(roomInfo.value))
          }
          
          // 路由跳转
          router.push({
            path: '/lobby',
            query: {
              role: role,
              key: key,
              nickname: nickname,
              avatar: avatar
            }
          })
          
          // 重置按钮状态
          hostLoading.value = false
        })
      } else {
        // 如果遮罩组件未准备好，使用备用方案
        console.warn('[HelloPage] 遮罩组件未准备好，直接跳转')
        if (key) {
          store.joinLobbyWithKey(role, key, nickname, avatar)
        }
        if (roomInfo.value && roomInfo.value.keys) {
          localStorage.setItem('roomInfo', JSON.stringify(roomInfo.value))
        }
        router.push({
          path: '/lobby',
          query: {
            role: role,
            key: key,
            nickname: nickname,
            avatar: avatar
          }
        })
        hostLoading.value = false
      }
    }
  }, 30) // 每30ms增加1%，3秒到100%
}

// 计算选手/观众按钮样式
const playerButtonClass = computed(() => {
  if (joinSuccess.value) {
    return 'confirm-button-success' // 成功绿色
  }
  if (isJoining.value) {
    return 'confirm-button-loading' // 加载灰色
  }
  return '' // 默认蓝色
})

// 选手/观众加入（细化按钮表现）
const handlePlayerJoin = () => {
  // 双重验证：确保信息已填写
  if (!canJoin.value || isJoining.value || joinSuccess.value) {
    if (!userNickname.value.trim()) {
      alert('请输入代号')
    } else if (!userAvatar.value) {
      alert('请上传头像或选择默认头像')
    }
    return
  }
  
  playButtonSound() // 播放按钮音效
  
  isJoining.value = true
  
  // 从URL参数或store获取凭证
  const role = selectedRole.value
  const key = route.query.key || store.credentials.key
  const nickname = userNickname.value.trim()
  const avatar = userAvatar.value

  console.log('[HelloPage] 正在加入房间:', { role, key, nickname, avatar })
  
  if (!key) {
    console.error('[HelloPage] 缺少key，无法加入房间')
    alert('缺少邀请key，请使用正确的邀请链接')
    isJoining.value = false
    return
  }
  
  // 模拟按钮加载进度（3秒，在98%时触发遮罩转场）
  let progress = 0
  const progressInterval = setInterval(() => {
    progress += 1
    
    // 在98%时触发遮罩转场
    if (progress >= 98) {
      clearInterval(progressInterval)
      
      isJoining.value = false
      joinSuccess.value = true // 切换为"成功"状态，变绿
      
      console.log('[HelloPage] 按钮进度98%，启动遮罩转场')
      console.log('[HelloPage] 用户已加入房间')
      
      // 启动遮罩转场
      if (maskRef.value) {
        let transitionCompleted = false
        const transitionTimeout = setTimeout(() => {
          if (!transitionCompleted) {
            console.error('[HelloPage] 遮罩转场超时，使用备用方案')
            transitionCompleted = true
            // 备用方案：直接跳转
            if (key) {
              store.joinLobbyWithKey(role, key, nickname, avatar)
            }else{
              router.push({
                path: '/lobby',
                query: {
                  role: role,
                  key: key,
                  nickname: nickname,
                  avatar: avatar
                }
              })
              return
            }
            setTimeout(() => {
              joinSuccess.value = false
            }, 500)
          }
        }, 5000) // 5秒超时
        
        maskRef.value.start(() => {
          if (transitionCompleted) return
          transitionCompleted = true
          clearTimeout(transitionTimeout)
          
          // 遮罩完全覆盖时执行
          // 调用Store加入大厅（使用key）
          if (key) {
            store.joinLobbyWithKey(role, key, nickname, avatar)
          } else {
            console.error('[HelloPage] 缺少key，无法加入大厅')
            joinSuccess.value = false
            return
          }
          
          // 路由跳转
          router.push({
            path: '/lobby',
            query: {
              role: role,
              key: key,
              nickname: nickname,
              avatar: avatar
            }
          })
          
          // 重置状态
          setTimeout(() => {
            joinSuccess.value = false
          }, 500)
        })
      } else {
        // 如果遮罩组件未准备好，使用备用方案
        console.warn('[HelloPage] 遮罩组件未准备好，直接跳转')
        if (key) {
          store.joinLobbyWithKey(role, key, nickname, avatar)
        }
        router.push({
          path: '/lobby',
          query: {
            role: role,
            key: key,
            nickname: nickname,
            avatar: avatar
          }
        })
        setTimeout(() => {
          joinSuccess.value = false
        }, 500)
      }
    }
  }, 30) // 每30ms增加1%，3秒到100%
}

// 入口层样式（使用 clip-path 实现揭示效果）
const entryOverlayStyle = computed(() => {
  if (hasEntered.value) {
    // 动画结束后，彻底隐藏
    return { display: 'none' }
  }
  
  // 动态绑定 clip-path
  // inset(0 right 0 0) 表示从右边开始切
  // progress = 0: 全显示 (inset(0 0% 0 0))
  // progress = 100: 全切掉 (inset(0 100% 0 0))
  return {
    clipPath: `inset(0 ${transitionProgress.value}% 0 0)`,
    willChange: 'clip-path'
  }
})

// 跳转大厅的覆盖层样式（已废弃，改用 TransitionMask 遮罩转场）

// 开始转场（创建比赛/进入比赛现场按钮）- 使用揭示效果
const startSlitScan = () => {
  playButtonSound() // 播放按钮音效
  if (isTransitioning.value) return
  
  console.log('[HelloPage] 开始揭示转场')
  isTransitioning.value = true
  
  // 启动动画循环
  let p = 0
  const animate = () => {
    // 使用缓动函数 (ease-out)
    // 简单的二次缓动
    const easeOut = (t) => 1 - Math.pow(1 - t, 3)
    const normalizedProgress = p / 100
    const easedProgress = easeOut(normalizedProgress)
    
    transitionProgress.value = easedProgress * 100
    
    if (p < 100) {
      p += 0.5 // 速度控制：35% 的原始速度 (2.5 * 0.35 = 0.875)
      requestAnimationFrame(animate)
    } else {
      // 动画结束
      transitionProgress.value = 100
      hasEntered.value = true
      isTransitioning.value = false
      
      // 自动模式：选中角色
      if (isAutoMode.value) {
        const role = route.query.role || store.credentials.role
        if (role) {
          setTimeout(() => {
            selectedRole.value = role
          }, 300)
        }
        // 延迟触发通知条滑入动画
        setTimeout(() => {
          showAutoNotice.value = true
        }, 500)
      }
    }
  }
  
  requestAnimationFrame(animate)
}

// 背景轮播
let bgInterval = null
const rotateBackground = () => {
  currentBgIndex.value = (currentBgIndex.value + 1) % bgList.value.length
  moveDirection.value = {
    x: (Math.random() - 0.5) * 60,
    y: (Math.random() - 0.5) * 60
  }
}

// 自动模式初始化（检测URL参数）
const initAutoMode = () => {
  try {
    const role = route.query.role
    const key = route.query.key
    
    if (role && key) {
      // 触发自动模式
      isAutoMode.value = true
      
      // 根据角色设置提示文本
      const roleMap = {
        'HOST': '主持人',
        'TEAM_A': 'A队选手',
        'TEAM_B': 'B队选手',
        'SPECTATOR': '观众'
      }
      autoModeRoleText.value = roleMap[role] || role
      
      // 存储凭证（添加错误处理）
      if (store && typeof store.setCredentials === 'function') {
        store.setCredentials(role, key)
        console.log('[HelloPage] 自动模式激活，凭证已存储:', { role, key })
      } else {
        console.error('[HelloPage] store.setCredentials 方法不存在！')
        // 即使方法不存在，也继续执行，不影响页面显示
      }
      
      console.log('[HelloPage] 自动模式激活:', { role, key })
      
      // 自动模式不需要立即设置角色，等待用户点击"进入比赛现场"按钮后触发转场
    } else {
      console.log('[HelloPage] 非自动模式，URL参数不完整:', { role, key })
    }
  } catch (error) {
    console.error('[HelloPage] 自动模式初始化失败:', error)
    // 即使出错，也不影响页面正常显示
    isAutoMode.value = false
  }
}

onMounted(() => {
  // 检查是否自动模式
  initAutoMode()
  
  bgInterval = setInterval(rotateBackground, 15000)
  rotateBackground()
})

onUnmounted(() => {
  if (bgInterval) clearInterval(bgInterval)
})
</script>

<style scoped>
.home-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  background-color: #000000;
  overflow: hidden;
  font-family: 'Microsoft YaHei', 'SimHei', 'Arial', sans-serif;
  user-select: none;
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

/* 背景容器 */
.background-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.background-image {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 15s linear, opacity 2s ease-in-out;
}

/* 身份选择内容 */
.identity-content {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 48px;
}

.identity-title {
  color: #ffffff;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 8px;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

/* 按钮容器 */
.role-buttons-container {
  position: relative;
  width: 100%;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 身份按钮基础样式 */
.role-btn {
  position: absolute;
  width: 192px;
  height: 256px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 1s cubic-bezier(0.165, 0.84, 0.44, 1); /* 从快到慢的非匀速动画 */
  transform-origin: center center;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%);
}

.role-btn:not(.selected):not(:disabled):not(.locked):hover {
  transform: translateY(-8px) scale(1.05);
  background: rgba(0, 0, 0, 0.6);
}

.role-btn.hidden {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.5);
}

.role-btn.selected {
  pointer-events: none;
  z-index: 20;
}

.btn-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #ffffff;
}

.icon-container {
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.icon-placeholder {
  font-size: 32px;
}

.role-icon-image {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.role-name {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 4px;
  transition: all 0.3s ease;
}

.role-subtitle {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 2px;
  font-family: 'Arial', sans-serif;
}

/* 主持人按钮 */
.role-host.selected .icon-container,
.role-host:hover .icon-container {
  background: #FFCD00;
}

.role-host.selected .role-name,
.role-host:hover .role-name {
  color: #FFCD00;
}

.role-host.selected,
.role-host:hover {
  border-color: #FFCD00;
  box-shadow: 0 0 30px rgba(255, 205, 0, 0.4);
}

/* 队伍A按钮 */
.role-team_a.selected .icon-container,
.role-team_a:hover .icon-container {
  background: #00C8FF;
}

.role-team_a.selected .role-name,
.role-team_a:hover .role-name {
  color: #00C8FF;
}

.role-team_a.selected,
.role-team_a:hover {
  border-color: #00C8FF;
  box-shadow: 0 0 30px rgba(0, 200, 255, 0.4);
}

/* 队伍B按钮 */
.role-team_b.selected .icon-container,
.role-team_b:hover .icon-container {
  background: #FF3333;
}

.role-team_b.selected .role-name,
.role-team_b:hover .role-name {
  color: #FF3333;
}

.role-team_b.selected,
.role-team_b:hover {
  border-color: #FF3333;
  box-shadow: 0 0 30px rgba(255, 51, 51, 0.4);
}

/* 观众按钮 */
.role-spectator.selected .icon-container,
.role-spectator:hover .icon-container {
  background: #32FF64;
}

.role-spectator.selected .role-name,
.role-spectator:hover .role-name {
  color: #32FF64;
}

.role-spectator.selected,
.role-spectator:hover {
  border-color: #32FF64;
  box-shadow: 0 0 30px rgba(50, 255, 100, 0.4);
}

/* 右侧面板 */
.right-panel {
  position: absolute;
  left: calc(50% + 50px); /* 在按钮右侧，整体居中 */
  top: 50%;
  transform: translateY(-50%);
  width: 500px;
  padding-left: 48px;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
}

/* 个人信息设置区域 */
.profile-section {
  margin: 24px 0;
}

.profile-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.profile-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 2px;
  font-family: 'Arial', 'Consolas', monospace;
  transition: color 0.3s ease;
}

.profile-input {
  background: transparent;
  border: none;
  border-bottom: 2px solid rgba(255, 255, 255, 0.3);
  padding: 8px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  outline: none;
  transition: border-color 0.3s ease;
  font-family: 'Arial', sans-serif;
}

.profile-input:focus {
  border-bottom-color: #00C8FF;
}

.profile-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.profile-input-group:focus-within .profile-label {
  color: #00C8FF;
}

.avatar-upload-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-file-input {
  display: none;
}

.avatar-upload-button {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.avatar-upload-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #00C8FF;
  color: #00C8FF;
}

.avatar-upload-tip {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
  letter-spacing: 1px;
}

/* 头像预览 */
.avatar-preview {
  width: 48px;
  height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: #000000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.avatar-preview.has-avatar {
  border-color: #FB7299;
  box-shadow: 0 0 15px rgba(251, 114, 153, 0.4);
}

.avatar-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #FB7299;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(1.1);
}

.avatar-placeholder {
  font-size: 8px;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  line-height: 1.2;
  font-family: 'Arial', 'Consolas', monospace;
}

.avatar-corner {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 8px;
  background: #FB7299;
  clip-path: polygon(0 0, 100% 0, 100% 100%);
}


/* 确认按钮 */
.confirm-button {
  position: relative;
  padding: 16px 32px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%);
  overflow: hidden;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-button:hover:not(:disabled) {
  background: #ffffff;
  color: #000000;
}

.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-button-blue {
  background: rgba(0, 200, 255, 0.2);
  border-color: #00C8FF;
  color: #00C8FF;
}

.confirm-button-blue:hover {
  background: #00C8FF;
  color: #000000;
}

/* 主持人按钮加载状态 */
.host-confirm-btn.loading {
  cursor: wait;
  background: rgba(255, 205, 0, 0.1);
  border-color: #FFCD00;
  color: #FFCD00;
}

.host-confirm-btn .loading-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: #FFCD00;
  width: 0%;
  animation: progressBar 3s linear forwards;
}

@keyframes progressBar {
  to {
    width: 100%;
  }
}

/* 选手/观众按钮状态 */
.confirm-button-loading {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.5);
  cursor: wait;
}

.confirm-button-success {
  background: #32FF64;
  border-color: #32FF64;
  color: #000000;
  cursor: default;
}

.button-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-content {
  gap: 12px;
}

.success-content {
  gap: 8px;
  font-weight: 700;
}

.success-icon {
  font-size: 20px;
  line-height: 1;
}

.button-prefix {
  font-weight: 700;
  font-style: italic;
  margin-right: 8px;
}

.loading-text {
  font-family: 'Arial', 'Consolas', monospace;
  letter-spacing: 2px;
  font-size: 14px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  animation: spin 0.8s linear infinite;
}

.spinner-circle {
  opacity: 0.25;
}

.spinner-path {
  opacity: 0.75;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 返回按钮 */
.return-button {
  position: absolute;
  top: 80px;
  left: 32px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: color 0.3s ease;
  font-size: 12px;
  letter-spacing: 2px;
}

.return-button:hover {
  color: #ffffff;
}

.return-icon {
  font-size: 18px;
}

/* 身份内容层（底层） */
.identity-layer {
  position: absolute;
  inset: 0;
  z-index: 10;
}

/* 入口层（顶层，使用 clip-path 实现揭示效果） */
.entry-overlay-container {
  position: absolute;
  inset: 0;
  z-index: 100; /* 最高层级 */
  /* 背景：深灰 -> 纯黑 径向渐变 */
  background: radial-gradient(circle at center, #2a2a2a 0%, #000000 100%);
  will-change: clip-path;
}

.entry-content {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 2; /* 确保内容在粒子之上 */
}

.entry-content .top-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.entry-content .bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
}

/* 按钮包裹层，确保按钮在粒子上面 */
.entry-content .entry-btn-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10; /* 高于粒子的 z-index: 1 */
}

/* 分割线（必须在容器外，避免被 clip-path 切掉） */
.slit-line {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 2px;
  z-index: 200; /* 比 overlay 更高 */
  pointer-events: none;
}

.line-core {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 
    0 0 10px rgba(255, 255, 255, 1),
    0 0 20px rgba(0, 200, 255, 0.8); /* 强烈的蓝白光晕 */
}

.line-glow {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -50px;
  width: 100px;
  background: linear-gradient(90deg, 
    rgba(255, 255, 255, 0) 0%, 
    rgba(255, 255, 255, 0.1) 50%, 
    rgba(255, 255, 255, 0) 100%);
  opacity: 0.6;
}

/* 创建比赛按钮 */
.create-button {
  position: relative;
  padding: 16px 48px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  font-size: 20px;
  font-weight: 300;
  letter-spacing: 6px;
  cursor: pointer;
  transition: all 0.5s ease;
  overflow: hidden;
}

.create-button:hover {
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
}

/* 按钮点击时的消失动画 */
.create-button.clicked {
  opacity: 0;
  transform: scale(1.1);
  filter: blur(5px);
  pointer-events: none;
}

.button-text {
  position: relative;
  z-index: 2;
}

.button-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transform: skewX(-20deg);
  transition: left 0.75s ease;
}

.create-button:hover .button-shine {
  left: 125%;
}

/* 背景淡入淡出动画 */
.fade-slow-enter-active,
.fade-slow-leave-active {
  transition: opacity 2s ease-in-out;
}

.fade-slow-enter-from,
.fade-slow-leave-to {
  opacity: 0;
}

/* 移除淡入淡出动画，统一使用 TransitionWipe 组件 */

/* 自动模式通知条 */
.auto-mode-notice {
  position: absolute;
  top: 80px;
  left: 0;
  width: 100%;
  background: rgba(0, 200, 255, 0.1);
  border-top: 1px solid rgba(0, 200, 255, 0.3);
  border-bottom: 1px solid rgba(0, 200, 255, 0.3);
  backdrop-filter: blur(10px);
  z-index: 40;
  padding: 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  /* 初始状态：在右侧外 */
  transform: translateX(100%);
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); /* 非匀速，无弹性 */
}

/* 滑入状态：回到正常位置 */
.auto-mode-notice.slide-in {
  transform: translateX(0);
}

.notice-indicator {
  width: 8px;
  height: 8px;
  background: #00C8FF;
  border-radius: 50%;
  /* 初始状态：在右侧外，透明度为0 */
  transform: translateX(50px);
  opacity: 0;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s, 
              opacity 0.5s ease 0.2s;
}

/* 指示器滑入状态 */
.auto-mode-notice.slide-in .notice-indicator {
  transform: translateX(0);
  opacity: 1;
  /* 滑入完成后再开始 ping 动画 */
  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite 0.7s; /* 延迟0.7s开始 */
}

@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

.notice-text {
  font-family: 'Oswald', sans-serif;
  letter-spacing: 0.2em;
  color: #00C8FF;
  font-size: 14px;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(0, 200, 255, 0.8);
  /* 初始状态：在右侧外，透明度为0 */
  transform: translateX(50px);
  opacity: 0;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s, 
              opacity 0.5s ease 0.2s; /* 延迟0.2s，等背景条先滑入 */
}

/* 文字滑入状态 */
.notice-text.text-slide-in {
  transform: translateX(0);
  opacity: 1;
}

/* 邀请链接容器 */
.invite-links-container {
  margin: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.invite-link-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-family: 'Arial', sans-serif;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #00C8FF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.invite-link-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.invite-link-label {
  width: 96px;
  font-size: 10px;
  font-family: 'Oswald', sans-serif;
  letter-spacing: 2px;
  text-align: right;
  font-weight: 500;
}

.invite-link-wrapper {
  flex: 1;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  height: 32px;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  min-width: 0; /* 允许flex子元素缩小 */
}

.invite-link-text {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Consolas', 'Monaco', monospace;
  font-style: italic;
  padding: 0 12px;
  padding-right: 80px; /* 为复制按钮留出空间 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: all;
  min-width: 0; /* 允许文本区域缩小 */
}

.invite-link-copy-btn {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Arial', sans-serif;
  white-space: nowrap; /* 防止按钮文字换行 */
  z-index: 1; /* 确保按钮在文本之上 */
}

.invite-link-copy-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.invite-link-copy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 个人信息登记区域 */
.registration-header {
  margin-bottom: 24px;
  padding-left: 12px;
  border-left: 2px solid #00C8FF;
}

.registration-title {
  color: #00C8FF;
  font-family: 'Oswald', sans-serif;
  font-size: 18px;
  letter-spacing: 2px;
  font-weight: 700;
  margin-bottom: 4px;
}

.registration-subtitle {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 1px;
}

.profile-form-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 24px;
}

.avatar-registration-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.avatar-preview-large {
  width: 96px;
  height: 96px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: #000000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
}

.avatar-preview-large.has-avatar {
  border-color: #00C8FF;
  box-shadow: 0 0 15px rgba(0, 200, 255, 0.4);
}

.avatar-image-large {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder-large {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  line-height: 1.4;
  font-family: 'Arial', 'Consolas', monospace;
  font-weight: 700;
}

.avatar-corner-large {
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  clip-path: polygon(0 0, 100% 0, 100% 100%);
}

.default-avatar-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: #00C8FF;
  color: #000000;
  font-size: 10px;
  text-align: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s ease;
  font-weight: 700;
  padding: 4px 0;
  font-family: 'Arial', sans-serif;
}

.avatar-preview-large:hover .default-avatar-overlay {
  opacity: 1;
}

.avatar-required-tip {
  font-size: 10px;
  color: #FF3333;
  text-align: center;
}

.nickname-registration-group {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nickname-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Arial', 'Consolas', monospace;
  letter-spacing: 2px;
}

.nickname-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 2px solid rgba(255, 255, 255, 0.3);
  padding: 8px 0;
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  outline: none;
  transition: border-color 0.3s ease;
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
}

.nickname-input:focus {
  border-bottom-color: #00C8FF;
}

.nickname-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.nickname-required-tip {
  font-size: 10px;
  color: #FF3333;
}

/* QQ获取区域样式 - 主持人面板 */
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
  padding: 8px 16px;
  background: rgba(0, 200, 255, 0.1);
  border: 1px solid rgba(0, 200, 255, 0.3);
  color: #00C8FF;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Arial', sans-serif;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
}

.qq-btn:hover:not(:disabled) {
  background: rgba(0, 200, 255, 0.2);
  border-color: #00C8FF;
  color: #ffffff;
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

/* QQ获取区域样式 - 队伍A/B/观众面板 */
.qq-fetch-section-registration {
  width: 100%;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
}

.qq-input-wrapper-registration {
  display: flex;
  gap: 10px;
  align-items: center;
}

.qq-input-registration {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 2px solid rgba(255, 255, 255, 0.3);
  padding: 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  outline: none;
  transition: border-color 0.3s ease;
  font-family: 'Consolas', monospace;
}

.qq-input-registration:focus {
  border-bottom-color: #00C8FF;
}

.qq-input-registration::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.qq-btn-registration {
  white-space: nowrap;
  padding: 8px 16px;
  background: rgba(0, 200, 255, 0.1);
  border: 1px solid rgba(0, 200, 255, 0.3);
  color: #00C8FF;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Arial', sans-serif;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
}

.qq-btn-registration:hover:not(:disabled) {
  background: rgba(0, 200, 255, 0.2);
  border-color: #00C8FF;
  color: #ffffff;
}

.qq-btn-registration:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qq-tip-registration {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 6px;
  letter-spacing: 1px;
}

.avatar-upload-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.avatar-upload-button-large {
  padding: 8px 24px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  font-family: 'Arial', sans-serif;
}

.avatar-upload-button-large:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #00C8FF;
  color: #00C8FF;
}

/* 头像选择弹窗 */
.avatar-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.avatar-modal-container {
  background: #121212;
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  padding: 24px;
  position: relative;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%);
}

.avatar-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.avatar-modal-title {
  color: #00C8FF;
  font-family: 'Oswald', sans-serif;
  letter-spacing: 2px;
  font-size: 18px;
  font-weight: 700;
}

.avatar-modal-close {
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  transition: all 0.3s ease;
  font-family: 'Arial', sans-serif;
}

.avatar-modal-close:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.avatar-modal-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}

.avatar-modal-grid::-webkit-scrollbar {
  width: 4px;
}

.avatar-modal-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.avatar-modal-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.avatar-modal-item {
  aspect-ratio: 1;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: #000000;
  cursor: pointer;
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
}

.avatar-modal-item:hover {
  border-color: #00C8FF;
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(0, 200, 255, 0.4);
}

.avatar-modal-item.selected {
  border-color: #00C8FF;
  border-width: 3px;
  box-shadow: 0 0 20px rgba(0, 200, 255, 0.6);
}

.avatar-modal-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.3);
  transition: filter 0.3s ease;
}

.avatar-modal-item:hover .avatar-modal-image {
  filter: grayscale(0);
}

.avatar-modal-item.selected .avatar-modal-image {
  filter: grayscale(0);
}

.avatar-modal-check {
  position: absolute;
  inset: 0;
  background: rgba(0, 200, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: #00C8FF;
  text-shadow: 0 0 10px rgba(0, 200, 255, 0.8);
}

/* 锁定遮罩层 */
.lock-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.lock-icon-large {
  font-size: 32px;
  opacity: 0.5;
}

.role-btn.locked {
  cursor: not-allowed;
  opacity: 0.6;
  filter: grayscale(1);
  pointer-events: none; /* 完全禁用鼠标事件 */
}

.role-btn.locked:hover {
  transform: none !important;
  opacity: 0.6 !important;
}

.role-btn.locked .btn-inner {
  pointer-events: none;
}

.role-btn.locked .btn-inner:hover {
  background: transparent !important;
  border-color: inherit !important;
}
</style>
