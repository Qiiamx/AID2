// 音效管理工具
// 预加载音频文件，避免首次播放延迟

let buttonSound = null
let startSound = null

// 初始化音频（在应用启动时调用）
export const initSounds = () => {
  // 一般按钮音效
  buttonSound = new Audio('/music/button.mp3')
  buttonSound.volume = 0.5 // 设置音量（0-1）
  buttonSound.preload = 'auto'
  
  // Start match 按钮音效
  startSound = new Audio('/music/start.mp3')
  startSound.volume = 0.5
  startSound.preload = 'auto'
  
  console.log('[Sound] 音效初始化完成')
}

// 播放一般按钮音效
export const playButtonSound = () => {
  if (!buttonSound) {
    console.warn('[Sound] 按钮音效未初始化')
    return
  }
  
  try {
    // 重置播放位置，确保每次都能播放
    buttonSound.currentTime = 0
    buttonSound.play().catch(err => {
      console.warn('[Sound] 播放按钮音效失败:', err)
    })
  } catch (error) {
    console.warn('[Sound] 播放按钮音效异常:', error)
  }
}

// 播放 Start match 按钮音效
export const playStartSound = () => {
  if (!startSound) {
    console.warn('[Sound] Start音效未初始化')
    return
  }
  
  try {
    startSound.currentTime = 0
    startSound.play().catch(err => {
      console.warn('[Sound] 播放Start音效失败:', err)
    })
  } catch (error) {
    console.warn('[Sound] 播放Start音效异常:', error)
  }
}



