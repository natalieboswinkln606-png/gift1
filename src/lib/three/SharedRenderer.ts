import { WebGLRenderer } from 'three'

/**
 * 共享 WebGLRenderer 工厂函数。
 * 整个应用生命周期只创建一个 WebGL 上下文，消除场景切换时的 context 重建开销（~50-100ms/次）。
 */
export function createSharedRenderer(): WebGLRenderer {
  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false, // alpha:false + stencil:false 减少 GPU 显存占用（已确认 SelectiveBloom 不依赖 stencil）
  })
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  return renderer
}
