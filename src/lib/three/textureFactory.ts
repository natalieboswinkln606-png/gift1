import { CanvasTexture } from 'three'

/** 径向渐变色标 */
export interface GradientStop {
  offset: number  // 0-1
  color: string   // CSS 颜色字符串，如 'rgba(255,255,255,1)'
}

/**
 * 创建径向渐变 Canvas 纹理。
 * 从中心到边缘的圆形渐变，常用于粒子精灵和发光效果。
 *
 * @param size 纹理尺寸（正方形边长）
 * @param stops 渐变色标数组
 * @returns THREE.CanvasTexture
 */
export function createRadialGradientTexture(
  size: number,
  stops: GradientStop[]
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const half = size / 2
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half)
  for (const stop of stops) {
    grad.addColorStop(stop.offset, stop.color)
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}
