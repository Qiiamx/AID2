import { ref } from 'vue'
import { defineStore } from 'pinia'
// 在这里定义全局状态， 通过ws在所有用户之间传播
// 后端会以room id为单位，对room id下的所有用户发送广播
// room.id, team1.id team2.id vierer.id owner.id 由前端用户发起，后端创建生成
// 即： 
// 第一个用户点击创建， 后端生成并将 4+1个ID记为一组(room.id)，前端获得4个链接， owner/id0  team1/id1   team2/id2 viewer/id3 
// 所有用户进入各自的链接，通过链接向后端建立 ws连接
// 所有用户的操作，均携带ID向后端发送请求（前端不动，等下发刷新）
// 后端每次接到请求，计算新的 match,team1,team2，发给前端
// 前端接到数据，刷新 match, team1, team2
export const useMatchStore = defineStore('match', () => {
  // WebSocket连接
  const socket = ref(null)
  
  // 大厅数据（从服务器同步）
  const lobbyData = ref({
    hosts: [],
    teamA: [],
    teamB: [],
    spectators: []
  })
  
  // 当前用户信息（本地暂存，用于右上角显示）
  const myInfo = ref({
    nickname: '',
    avatar: '',
    role: '',
    socketId: null
  })
  
  // 比赛状态（是否已开始）
  const isGameStarted = ref(false)
  
  // 凭证存储（用于邀请链接）
  const credentials = ref({
    role: '',
    key: ''
  })
  
  // 【新增】中途加入机制：暂存快照数据
  const pendingRestoreData = ref(null) // 用于存储中途加入时的快照数据
  
  // 【新增】中途加入标志位（响应式状态，用于解决时序问题）
  const isJoinInProgress = ref(false) // 标记是否收到了中途加入消息
  
  // 设置凭证
  const setCredentials = (role, key) => {
    credentials.value = { role, key }
    console.log('[Store] 凭证已设置:', credentials.value)
  }
  
  // 使用key加入大厅
  const joinLobbyWithKey = (role, key, nickname, avatar) => {
    myInfo.value = {
      nickname: nickname || (role === 'HOST' ? 'Host' : `Doctor${Math.floor(Math.random() * 1000)}`),
      avatar: avatar || '',
      role: role,
      socketId: null
    }
    
    // 优先使用环境变量配置的 WebSocket 地址
    let wsUrl = ''
    if (import.meta.env.VITE_WS_URL) {
      // 使用环境变量配置的完整地址（如果已经包含路径，直接使用；否则添加 /ws）
      const baseUrl = import.meta.env.VITE_WS_URL
      const hasPath = baseUrl.includes('/ws') || baseUrl.endsWith('/')
      wsUrl = hasPath 
        ? `${baseUrl}${baseUrl.endsWith('/') ? '' : ''}?userId=${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : `${baseUrl}/ws?userId=${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    } else {
      // 默认逻辑：根据当前协议和主机名自动判断，添加 /ws 路径
      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsHost = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') 
        ? '127.0.0.1' 
        : location.hostname
      const wsPort = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? ':3000' : ''
      wsUrl = `${wsProtocol}//${wsHost}${wsPort}/ws?userId=${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    
    connectSocket(wsUrl)
    
    const message = {
      action: 'join_lobby',
      role: role,
      key: key, // 添加key验证
      nickname: myInfo.value.nickname,
      avatar: myInfo.value.avatar
    }

    const sendJoinMessage = () => {
      if (socket.value && socket.value.readyState === WebSocket.OPEN) {
        socket.value.send(JSON.stringify(message))
        console.log('[Socket] 发送加入大厅消息（带key）:', message)
      } else {
        console.warn('[Socket] WebSocket未连接，等待重试发送加入大厅消息...')
        setTimeout(sendJoinMessage, 500)
      }
    }
    sendJoinMessage()
  }
  
  //用户信息
  const userInfo = ref({
    userId: null,
    roomId: null,
    team1: false,
    team2: false,
    owner: false,
    viewer: false
  })
  //全局状态
  const match = ref({
    round: 1, // 当前轮次
    turn: 1, // 当前回合
    public_opr: ['opr1', 'opr2', 'opr3'], // 本轮的公共干员
    select_opr: 'opr1', // 本回合的博弈干员,
    ban_opr: [], // 禁用干员
    ban_branch: [], // 禁用分支
    timer: false, // 计时可用
  });
  const team1 = ref({
    id: '', // 由链接决定的id，用于匹配可见性
    name: '', //队伍名称
    nicknames: [''], //选手名称
    avatars: [''], //选手QQ-头像
    get_oprs: [''], //已获得的干员
    show_starts: [''], //显示星级的干员
    show_branches: [''], //显示分支的干员
    show_classes: [''], //显示职业的干员
    lastCP: 50, //明面剩余调用点 todo: 考虑到这几个点数有额外的博弈条件，不一定是这几个参数
    lastIP: 1, //剩余情报点
    betFlag: true //参与博弈
  });
  const team2 = ref({
    id: '',
    name: '', //队伍名称
    nicknames: [''], //选手名称
    avatars: [''], //选手QQ-头像
    get_oprs: [''], //已获得的干员
    show_starts: [''], //显示星级的干员
    show_branches: [''], //显示分支的干员
    show_classes: [''], //显示职业的干员
    lastCP: 50, //剩余调用点
    lastIP: 1, //剩余情报点
    betFlag: true //参与博弈
  });
  // 队伍操作
  const teamOpr = {
    useIP: async (id, cnt) => {
      // team 消耗情报点，服务器改变可见性，扣除ip
      alert('没做')
    },
    changeCP: async (id, cnt) => {
      // team 追加/撤回 调用点（临时）
      alert('没做')
    },
    quit: async (id) => {
      // team 不再参与本轮博弈
      alert('没做')
    }
  }
  // 比赛操作
  const matchOpr = {
    start: async (ws) => {
      //开始比赛，服务器发送timer信号，刷新第一轮第一回合，下发公共干员，配置team可见性
      match.value.timer = true
      submit(ws)
    },
    pause: async (ws) => {
      //暂停比赛， 服务器发送 timer 信号
      match.value.timer = false
      submit(ws)
    },
    end: async (ws) => {
      //结束比赛 （？）
      alert('没做')
    },
    nextTurn: async (ws) => {
      //新回合，要先手动分配上个博弈干员，生成新的博弈干员，更新回合数
      match.value.turn = match.value.turn + 1
      submit(ws)
    },
    nextRound: async (ws) => {
      //新轮次，生成新的3个干员，调整可见性，更新轮次数，更新回合数
      match.value.round = match.value.round + 1
      submit(ws)
    },
    show: async (ws) => {
      //揭开本回合博弈结果，扣除调用点，分配干员给队伍，调整可见性
      alert('没做')
    },
  }
  const submit = (ws)=>{
    ws.send(JSON.stringify({
      match: match.value,
      team1: team1.value,
      team2: team2.value
    }))
  }

  //服务器下发，专门的ws模块来调用
  const serverOpr = {
    render: (data) => {
      Object.assign(match.value, data.match)
      Object.assign(team1.value, data.team1)
      Object.assign(team2.value, data.team2)
    }
  }

  // 连接WebSocket
  const connectSocket = (serverUrl) => {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) {
      console.log('[Socket] 已连接，跳过')
      return
    }
    
    console.log('[Socket] 正在连接:', serverUrl)
    socket.value = new WebSocket(serverUrl)
    
    socket.value.onopen = () => {
      console.log('[Socket] 连接成功')
    }
    
    socket.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('[Store] 收到 WebSocket 消息:', data.type, data)
        
        // 1. 处理大厅更新
        if (data.type === 'update_lobby' && data.data) {
          lobbyData.value = {
            hosts: data.data.hosts || [],
            teamA: data.data.teamA || [],
            teamB: data.data.teamB || [],
            spectators: data.data.spectators || []
          }
          console.log('[Socket] 大厅数据已更新:', lobbyData.value)
        }
        
        // 2. 处理倒计时开始消息
        if (data.type === 'start_countdown') {
          console.log('[Socket] 收到倒计时开始消息（在store中）')
          // 这里不直接处理，让Lobby.vue的监听器处理
        }
        
        // 【新增】处理服务端强制跳转指令
        if (data.type === 'enter_match_trigger') {
          console.log('[Store] 收到服务端跳转指令，时间戳:', data.timestamp)
          // 使用 window 事件分发给 Lobby 组件
          window.dispatchEvent(new CustomEvent('enter-match-trigger', { 
            detail: { timestamp: data.timestamp } 
          }))
        }
        
        // 【新增】处理中途加入 (join_in_progress)
        if (data.type === 'join_in_progress') {
          console.log('[Store] 收到中途加入数据，准备跳转')
          // 1. 暂存数据
          pendingRestoreData.value = data.snapshot
          // 2. 设置标志位（响应式状态，用于解决时序问题）
          isJoinInProgress.value = true
          
          // 3. 广播事件通知 Lobby 组件进行跳转（为了兼容已加载的页面）
          window.dispatchEvent(new CustomEvent('join-in-progress-trigger'))
          console.log('[Store] 已设置中途加入标志位并广播事件')
        }
        
        // 3. 【关键】将所有游戏消息广播给组件
        // 使用统一的 window 事件，确保所有组件都能收到
        const gameEvents = [
          'opening_start',
          'opening_countdown',
          'opening_countdown_complete',
          'opening_complete',
          'bidding_animation_start',
          'bidding_start',
          'bidding_countdown',
          'bidding_resolve',
          'bidding_timeout_single_mode',
          'intel_unlocked',
          'bidding_waiting',
          'update_resources',
          'termination_update', // 终止状态更新
          'all_terminated', // 全部终止
          'choice_status_flash', // 博弈回合内选择状态播报（绿色闪烁）
          'terminate_status_flash', // 终止状态播报（红色闪烁）
          'strategy_transition_start', // 攻略过渡特效开始
          'strategy_turn_start', // 攻略回合开始
          'strategy_selection_update', // 攻略选择实时更新
          'strategy_turn_switch', // 攻略回合切换
          'strategy_all_complete', // 攻略全部完成
          'strategy_ops_deployed', // 攻略干员已部署（从队伍信息栏移除）
          'strategy_prep_start', // 攻略准备开始（已废弃，保留兼容）
          'strategy_confirmed_local', // 攻略确认（本地）
          'strategy_all_confirmed', // 双方都确认攻略（已废弃，保留兼容）
          'game_reset', // 游戏重置
          'match_reset', // 重置比赛（已废弃，保留兼容）
          'game_restore', // 游戏回溯（加载种子）
          'ban_pool_update', // 禁用池更新（服务器广播的全局禁用池状态）
          'game_paused', // 【新增】游戏暂停
          'game_resumed', // 【新增】游戏继续
          'error' // 也广播错误消息
        ]
        
        if (gameEvents.includes(data.type)) {
          // 统一使用 game-socket-message 事件名
          window.dispatchEvent(new CustomEvent('game-socket-message', { detail: data }))
          console.log(`[Store] 已广播游戏消息: ${data.type}`)
        }
        
        // 4. 兼容旧系统：game_start（已废弃，保留兼容）
        if (data.type === 'game_start') {
          console.log('[Socket] 收到开始比赛消息（旧格式）')
          isGameStarted.value = true
        }
        
        // 5. 兼容旧系统
        if (data.type) {
          switch(data.type) {
            case 'owner': userInfo.value.owner = true; break
            case 'team1': userInfo.value.team1 = true; break
            case 'team2': userInfo.value.team2 = true; break
            case 'viewer': userInfo.value.viewer = true; break
          }
        } else if (data.match) {
          serverOpr.render(data)
        }
      } catch (error) {
        console.error('[Socket] 解析消息失败:', error)
      }
    }
    
    socket.value.onerror = (error) => {
      console.error('[Socket] 连接错误:', error)
    }
    
    socket.value.onclose = (event) => {
      console.log('[Socket] 连接关闭', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      })
      
      // 如果不是正常关闭，尝试重连
      if (event.code !== 1000 && event.code !== 1001) {
        console.log('[Socket] 异常关闭，5秒后尝试重连...')
        setTimeout(() => {
          if (socket.value && socket.value.readyState !== WebSocket.OPEN) {
            console.log('[Socket] 尝试重新连接...')
            connectSocket(serverUrl)
          }
        }, 5000)
      }
    }
  }

  // 加入大厅
  const joinLobby = (role, key, nickname, avatar) => {
    myInfo.value = {
      nickname: nickname || (role === 'HOST' ? 'Host' : `Doctor${Math.floor(Math.random() * 1000)}`),
      avatar: avatar || '',
      role: role,
      socketId: null
    }
    
    // 获取WebSocket URL（后端WebSocket服务器在3000端口）
    // 自动检测：如果是localhost/127.0.0.1，使用127.0.0.1；否则使用当前访问的hostname
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    const isHttps = location.protocol === 'https:'
    const isNgrok = location.hostname.includes('ngrok') || location.hostname.includes('ngrok-free.app')
    
    // 确定协议
    const wsProtocol = isHttps ? 'wss:' : 'ws:'
    
    // 确定主机地址
    const wsHost = isLocalhost ? '127.0.0.1' : location.hostname
    
    // 确定端口
    // - localhost: 总是使用 :3000
    // - 局域网IP: 使用 :3000
    // - ngrok等HTTPS代理: 通常不需要端口（使用默认端口）
    let wsPort = ''
    if (isLocalhost) {
      wsPort = ':3000'
    }
    // ngrok等情况下，wsPort保持为空字符串
    
    // 添加 /ws 路径以匹配后端配置
    let wsUrl = `${wsProtocol}//${wsHost}${wsPort}/ws?userId=${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log('[Socket] WebSocket连接地址:', wsUrl)
    
    // 连接WebSocket
    connectSocket(wsUrl)
    
    // 等待连接成功后发送加入消息
    let retryCount = 0
    const maxRetries = 50 // 最多重试5秒
    
    const checkAndSend = () => {
      if (socket.value && socket.value.readyState === WebSocket.OPEN) {
        const message = {
          action: 'join_lobby',
          role: role,
          key: key,
          nickname: myInfo.value.nickname,
          avatar: myInfo.value.avatar
        }
        socket.value.send(JSON.stringify(message))
        console.log('[Socket] 发送加入大厅消息:', message)
      } else if (retryCount < maxRetries) {
        retryCount++
        setTimeout(checkAndSend, 100)
      } else {
        console.error('[Socket] 连接超时，无法发送加入大厅消息')
        alert('WebSocket连接失败，请刷新页面重试')
      }
    }
    checkAndSend()
  }

  // 更新个人信息
  const updateProfile = (nickname, avatar) => {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      console.warn('[Socket] WebSocket未连接，无法更新个人信息')
      return
    }
    
    // 更新本地信息
    if (nickname) myInfo.value.nickname = nickname
    if (avatar) myInfo.value.avatar = avatar
    
    // 发送给服务器
    const message = {
      action: 'update_profile',
      nickname: nickname,
      avatar: avatar
    }
    socket.value.send(JSON.stringify(message))
    console.log('[Socket] 发送更新个人信息消息:', message)
  }

  // 创建房间（HTTP API方式）
  const createRoom = async () => {
    try {
      const apiUrl = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api/create-room'
        : `${location.protocol}//${location.host}/api/create-room`
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      if (data.success) {
        console.log('[Store] 房间创建成功:', data)
        return data // 返回房间信息
      } else {
        console.error('[Store] 房间创建失败:', data.message)
        return null
      }
    } catch (error) {
      console.error('[Store] 创建房间API请求失败:', error)
      return null
    }
  }

  return { 
    userInfo, 
    match, 
    team1, 
    team2, 
    teamOpr, 
    matchOpr, 
    serverOpr,
    // 新增
    socket,
    lobbyData,
    myInfo,
    credentials, // 导出凭证
    isGameStarted, // 导出比赛状态
    pendingRestoreData, // 【新增】导出中途加入暂存数据
    isJoinInProgress, // 【新增】导出中途加入标志位
    connectSocket,
    joinLobby,
    joinLobbyWithKey, // 导出带key的加入方法
    setCredentials, // 导出设置凭证方法
    updateProfile,
    createRoom // 导出创建房间方法
  }
})
