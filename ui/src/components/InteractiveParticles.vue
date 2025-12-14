<template>
  <canvas ref="canvasRef" class="particle-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  dispersed: { type: Boolean, default: false } // 控制是否散开
})

const canvasRef = ref(null)
let ctx = null
let animationFrameId = null
let particles = []
// 鼠标位置 (初始在屏幕外，避免刚加载就扰动)
const mouse = { x: -1000, y: -1000, radius: 12.5 } // 调小至八分之一 (100 / 8 = 12.5)

// 淡入进度
const fadeInProgress = ref(0)
let startTime = null

// --- 粒子类定义 (保持你的参数不变) ---
class Particle {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.baseX = x // 记忆原始位置 (用于归位)
    this.baseY = y
    this.size = 1  // 粒子大小：保持原设置
    this.density = (Math.random() * 30) + 1 // 密度/重量 (影响移动速度)
    this.opacity = 0.1 // 不透明度保持10%
    
    // 常态下的不规则小范围移动参数
    this.offsetX = (Math.random() - 0.5) * 3 // 随机偏移X
    this.offsetY = (Math.random() - 0.5) * 3 // 随机偏移Y
    this.speedX = (Math.random() - 0.5) * 0.2 // 移动速度X
    this.speedY = (Math.random() - 0.5) * 0.2 // 移动速度Y
    this.range = 5 // 移动范围
    
    // 散开时的随机速度向量
    this.vx = (Math.random() - 0.5) * 10
    this.vy = (Math.random() - 0.5) * 10
  }

  draw(fadeInProgress, isDispersed) {
    // 散开时直接使用 opacity，不受淡入进度影响
    // 正常显示时应用淡入效果
    const finalOpacity = isDispersed ? this.opacity : (this.opacity * fadeInProgress)
    ctx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
  }

  update(isDispersed) {
    // --- 模式 A: 散开消失 (点击按钮后) ---
    if (isDispersed) {
      this.x += this.vx
      this.y += this.vy
      if (this.opacity > 0) this.opacity -= 0.001 // 逐渐变透明
    } 
    // --- 模式 B: 鼠标交互 + 常态不规则移动 (正常显示时) ---
    else {
      // 常态下的不规则小范围移动
      this.offsetX += this.speedX
      this.offsetY += this.speedY
      
      // 限制移动范围
      if (Math.abs(this.offsetX) > this.range) {
        this.speedX *= -1
        this.offsetX = Math.sign(this.offsetX) * this.range
      }
      if (Math.abs(this.offsetY) > this.range) {
        this.speedY *= -1
        this.offsetY = Math.sign(this.offsetY) * this.range
      }
      
      // 计算目标位置（基础位置 + 偏移）
      const targetX = this.baseX + this.offsetX
      const targetY = this.baseY + this.offsetY
      
      // 鼠标交互
      let dx = mouse.x - this.x
      let dy = mouse.y - this.y
      let distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < mouse.radius && distance > 0) {
        // 计算鼠标斥力
        let forceDirectionX = dx / distance
        let forceDirectionY = dy / distance
        let maxDistance = mouse.radius
        let force = (maxDistance - distance) / maxDistance
        let directionX = forceDirectionX * force * this.density
        let directionY = forceDirectionY * force * this.density

        // 被鼠标推开
        this.x = targetX - directionX * 1 
        this.y = targetY - directionY * 1
      } else {
        // 缓慢移动到目标位置（包含偏移）
        let dx = targetX - this.x
        let dy = targetY - this.y
        this.x += dx / 10
        this.y += dy / 10
      }
    }
  }
}

// --- 初始化逻辑 (改为图片) ---
const initParticles = () => {
  particles = []
  const width = window.innerWidth
  const height = window.innerHeight
  
  const img = new Image()
  // 请确保你的图片放在 public/images/logo_mask.png
  img.src = '/images/logo_mask.png' 

  img.onload = () => {
    // 1. 计算图片绘制位置（居中 + 保持比例）
    // Logo 占据屏幕高度的约 60% (0.4 * 1.5 = 0.6) 或宽度的 45% (0.3 * 1.5 = 0.45)
    const aspectRatio = img.width / img.height
    let newHeight = height * 0.6 // 放大1.5倍：0.4 * 1.5 = 0.6
    let newWidth = newHeight * aspectRatio
    
    // 如果太宽，限制一下（放大1.5倍：0.5 * 1.5 = 0.75）
    if (newWidth > width * 0.75) {
      newWidth = width * 0.75
      newHeight = newWidth / aspectRatio
    }

    // 居中坐标 (稍微向上偏一点，避开按钮)
    const x = (width - newWidth) / 2
    const y = (height - newHeight) / 2 - 60 

    // 2. 绘制图片到 Canvas
    // 必须先清空，防止调整窗口大小时叠加
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, x, y, newWidth, newHeight)

    // 3. 获取像素数据
    const imgData = ctx.getImageData(0, 0, width, height)
    const data = imgData.data // [r, g, b, a, r, g, b, a ...]

    // 4. 扫描像素生成粒子
    // step = 6 (越小粒子越密，太小会卡顿)
    const step = 6
    
    for (let py = 0; py < height; py += step) {
      for (let px = 0; px < width; px += step) {
        // 计算当前像素在数组中的索引
        // 一个像素占4个位置 (r,g,b,a)
        const index = (py * width + px) * 4
        
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]

        // 核心判断：如果是白色（或亮色）且不透明，则生成粒子
        // 因为原图是黑底白字，我们判断亮度 (r+g+b)/3 > 100
        if (a > 128 && (r + g + b) / 3 > 100) {
          particles.push(new Particle(px, py))
        }
      }
    }
    
    // 5. 清除原始图片，只留下粒子数据
    ctx.clearRect(0, 0, width, height)
    
    console.log(`[Particles] Logo loaded. Particles count: ${particles.length}`)
  }

  img.onerror = () => {
    console.error('[Particles] 图片加载失败，请检查 public/images/logo_mask.png 是否存在')
    // 降级方案：如果图片挂了，回退到文字
    fallbackToText(width, height)
  }
}

// 降级方案 (如果图片找不到，显示文字)
const fallbackToText = (width, height) => {
  ctx.fillStyle = 'white'
  // 动态调整字号：屏幕宽度的15% * 1.5 = 22.5%，最大200px * 1.5 = 300px（整体面积扩大1.5倍）
  const fontSize = Math.min(width * 0.225, 300) 
  ctx.font = `900 ${fontSize}px "Microsoft YaHei", sans-serif` 
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // 在画布中心绘制文字（居中显示）
  ctx.fillText('联 锁 博 弈', width / 2, height / 2 - 50)

  // 扫描像素数据
  const textCoordinates = ctx.getImageData(0, 0, width, height)
  
  // 生成粒子
  const step = 5 
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      // 检查 alpha 通道 (>128 表示有文字像素)
      if (textCoordinates.data[(y * 4 * textCoordinates.width) + (x * 4) + 3] > 128) {
        particles.push(new Particle(x, y))
      }
    }
  }
  
  // 清除原始文字，只保留粒子
  ctx.clearRect(0, 0, width, height)
}

// --- 动画循环 ---
const animate = () => {
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  
  // 淡入动画（如果不是散开状态）
  // 延迟1秒后开始淡入
  if (!props.dispersed && startTime !== null) {
    const elapsed = Date.now() - startTime
    if (elapsed >= 1000) {
      // 1秒后开始淡入
      if (fadeInProgress.value < 1) {
        fadeInProgress.value = Math.min(fadeInProgress.value + 0.02, 1)
      }
    } else {
      // 1秒内保持透明度为0
      fadeInProgress.value = 0
    }
  }
  
  for (let i = 0; i < particles.length; i++) {
    particles[i].draw(fadeInProgress.value, props.dispersed)
    particles[i].update(props.dispersed)
  }
  
  // 如果完全散开且透明，可以停止循环节省性能 (可选)
  // 这里为了简单保持循环
  animationFrameId = requestAnimationFrame(animate)
}

// --- 事件监听 ---
const handleResize = () => {
  canvasRef.value.width = window.innerWidth
  canvasRef.value.height = window.innerHeight
  initParticles() // 窗口大小改变时重新计算图片位置和粒子
}

const handleMouseMove = (e) => {
  mouse.x = e.clientX
  mouse.y = e.clientY
}

// --- 生命周期 ---
onMounted(() => {
  const canvas = canvasRef.value
  ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  // 初始化淡入进度为0
  fadeInProgress.value = 0
  
  // 记录开始时间，用于延迟1秒淡入
  startTime = Date.now()

  initParticles()
  animate()

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('resize', handleResize)
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>

<style scoped>
.particle-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* 关键：不能阻挡鼠标点击按钮 */
  z-index: 1; /* 放在背景之上，文字之下 */
}
</style>
