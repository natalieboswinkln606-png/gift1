import type { QualityLevel, QualityPreset } from '@/types'

// 质量预设表
const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  HIGH: { particleCount: 45000, bgStarCount: 8000, pixelRatioMax: 2.0, bloomScale: 1.0, trunkCount: 4000, heartParticleCount: 6400 },
  MEDIUM: { particleCount: 25000, bgStarCount: 5000, pixelRatioMax: 1.5, bloomScale: 0.5, trunkCount: 2200, heartParticleCount: 5000 },
  LOW: { particleCount: 15000, bgStarCount: 3000, pixelRatioMax: 1.0, bloomScale: 0.5, trunkCount: 1300, heartParticleCount: 3200 },
  ULTRA_LOW: { particleCount: 5000, bgStarCount: 1000, pixelRatioMax: 1.0, bloomScale: 0, trunkCount: 500, heartParticleCount: 1500 },
}

// 已知高端 GPU 关键字（匹配 WebGL RENDERER 字符串）
const HIGH_END_GPU_KEYWORDS = [
  'rtx', 'gtx 1070', 'gtx 1080', 'gtx 1660', 'gtx 1650',
  'rx 5', 'rx 6', 'rx 7',
  'radeon pro',
  'apple m', 'apple gpu',
  'mali-g7', 'mali-g610',
  'adreno 7', 'adreno 6',
]

// 已知低端 GPU 关键字
const LOW_END_GPU_KEYWORDS = [
  'intel hd', 'intel uhd', 'intel iris',
  'mali-4', 'mali-t',
  'adreno 3', 'adreno 4', 'adreno 5',
  'powervr',
  'swiftshader', 'llvmpipe', 'mesa',
]

// 模块级缓存：GPU 信息在页面生命周期内不变，避免重复查询 WebGL 扩展
let _cachedQuality: QualityLevel | null = null

/**
 * 检测设备性能等级
 * 需要传入已创建的 WebGLRenderer 以获取 GPU 信息
 */
export function detectQuality(renderer: import('three').WebGLRenderer): QualityLevel {
  if (_cachedQuality !== null) return _cachedQuality

  const gl = renderer.getContext()
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  const gpuRenderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase()
    : ''

  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
    || navigator.maxTouchPoints > 2

  const cores = navigator.hardwareConcurrency || 4
  const dpr = window.devicePixelRatio || 1

  interface NavigatorWithMemory extends Navigator {
    deviceMemory?: number
  }
  const memory = (navigator as NavigatorWithMemory).deviceMemory

  // 检查是否匹配高端 GPU
  const isHighGPU = HIGH_END_GPU_KEYWORDS.some((kw) => gpuRenderer.includes(kw))
  // 检查是否匹配低端 GPU
  const isLowGPU = LOW_END_GPU_KEYWORDS.some((kw) => gpuRenderer.includes(kw))

  // 决策逻辑
  // 1CPU/2GB 服务器或极低端设备 → ULTRA_LOW（结合 GPU 关键字检测）
  let result: QualityLevel
  if (memory !== undefined && memory <= 2) {
    // 即使内存低，如果有高端 GPU 也给 LOW 而非 ULTRA_LOW
    result = isHighGPU ? 'LOW' : 'ULTRA_LOW'
  } else if (cores <= 1) {
    // 单核设备（含 1CPU 服务器）→ 强制 ULTRA_LOW
    result = 'ULTRA_LOW'
  } else if (isLowGPU) {
    result = memory !== undefined && memory <= 4 ? 'ULTRA_LOW' : 'LOW'
  } else if (isMobile && !isHighGPU) {
    result = 'LOW'
  } else if (isHighGPU) {
    result = 'HIGH'
  } else if (cores >= 6 && dpr >= 1.5 && !isMobile) {
    result = 'HIGH'
  } else if (memory === undefined && cores <= 2 && !isHighGPU) {
    // deviceMemory 不可用 + 2核以下 → 保守降级
    result = 'LOW'
  } else if (cores >= 4 && (memory === undefined || memory >= 4)) {
    result = 'MEDIUM'
  } else {
    result = 'LOW'
  }

  _cachedQuality = result
  return result
}

/**
 * 获取质量预设参数
 */
export function getQualityPreset(level: QualityLevel): QualityPreset {
  return { ...QUALITY_PRESETS[level] }
}
