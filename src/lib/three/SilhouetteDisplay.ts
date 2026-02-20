import {
  CanvasTexture,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Material,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three'

/**
 * 人物轮廓展示系统
 * 1. 加载用户轮廓图 → Canvas 颜色翻转 + 边缘检测 + 去背景 → 白色线条纹理
 * 2. 贴到 3D 平面上，位于两条字幕条中间
 */

const SILHOUETTE_HEIGHT = 40 // 3D 空间中的高度

export class SilhouetteDisplay {
  private group: Group
  private silhouetteMesh: Mesh | null = null
  private silhouetteTexture: CanvasTexture | null = null
  private maxAnisotropy = 1
  private disposed = false

  constructor(scene: Scene, renderer?: WebGLRenderer) {
    this.group = new Group()
    this.group.visible = false
    scene.add(this.group)
    if (renderer) {
      this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
    }
  }

  /**
   * 带重试的图片加载（指数退避）
   */
  private async loadImageWithRetry(url: string, maxRetries = 3): Promise<HTMLImageElement> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (this.disposed) throw new Error('已销毁，中断加载')
      try {
        const img = new Image()
        // 同域静态资源不需要 crossOrigin，设置后反而触发 CORS 预检失败
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('轮廓图加载超时')), 30000)
          img.onload = () => { clearTimeout(timeoutId); resolve() }
          img.onerror = () => { clearTimeout(timeoutId); reject(new Error('轮廓图加载失败')) }
          img.src = url
        })
        return img
      } catch (e) {
        console.warn(`[SilhouetteDisplay] 加载尝试 ${attempt + 1}/${maxRetries} 失败:`, e)
        if (attempt === maxRetries - 1) throw e
        if (this.disposed) throw new Error('已销毁，中断加载')
        // 指数退避：1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }
    throw new Error('不可达')
  }

  /**
   * 异步加载并处理轮廓图
   */
  async loadSilhouette(userId: string, silhouettePath: string): Promise<void> {
    if (!silhouettePath) return

    try {
      const img = await this.loadImageWithRetry(`/users/${userId}/${silhouettePath}`)
      if (this.disposed) return

      // 处理图片：颜色翻转 + 边缘检测 + 去背景
      const processedCanvas = this.processImage(img)

      // 创建纹理和 mesh
      this.silhouetteTexture = new CanvasTexture(processedCanvas)
      this.silhouetteTexture.generateMipmaps = true
      this.silhouetteTexture.minFilter = LinearMipmapLinearFilter
      this.silhouetteTexture.magFilter = LinearFilter
      this.silhouetteTexture.anisotropy = Math.min(4, this.maxAnisotropy)

      const aspect = processedCanvas.width / processedCanvas.height
      const height = SILHOUETTE_HEIGHT
      const width = height * aspect

      const geo = new PlaneGeometry(width, height)
      const mat = new MeshBasicMaterial({
        map: this.silhouetteTexture,
        transparent: true,
        blending: NormalBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: true,
      })

      this.silhouetteMesh = new Mesh(geo, mat)
      // 不加入辉光层，避免辉光叠加导致过曝
      // 人像上升5单位
      this.silhouetteMesh.position.set(0, 5, 0)
      this.group.add(this.silhouetteMesh)

    } catch (e) {
      console.warn('[SilhouetteDisplay] 加载失败:', e)
    }
  }

  /**
   * 图像处理流水线：颜色翻转 + Sobel 边缘检测 + 去背景 → 白色线条
   */
  private processImage(img: HTMLImageElement): HTMLCanvasElement {
    // 缩放到合理处理尺寸（1024 保证轮廓纹理清晰度，仅加载时执行一次）
    const maxDim = 1024
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.floor(img.width * scale)
    const h = Math.floor(img.height * scale)

    // 源 canvas
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = w
    srcCanvas.height = h
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.drawImage(img, 0, 0, w, h)
    const srcData = srcCtx.getImageData(0, 0, w, h)
    const src = srcData.data
    // 释放源 canvas 内存（不再需要）
    srcCanvas.width = 0

    // 灰度化
    const gray = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) {
      gray[i] = src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114
    }

    // 背景检测（边框采样）
    const borderSamples: number[] = []
    for (let x = 0; x < w; x++) {
      borderSamples.push(gray[x])
      borderSamples.push(gray[(h - 1) * w + x])
    }
    for (let y = 0; y < h; y++) {
      borderSamples.push(gray[y * w])
      borderSamples.push(gray[y * w + w - 1])
    }
    const avgBg = borderSamples.reduce((a, b) => a + b, 0) / borderSamples.length
    const bgTolerance = 30 // 从 40 降低到 30，更敏感地识别背景

    // Sobel 边缘检测（直接基于灰度图，不做高斯模糊预处理以保持线条锐利）
    const edges = new Float32Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        // 跳过背景像素
        if (Math.abs(gray[idx] - avgBg) < bgTolerance) continue

        const gx =
          -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)]
          - 2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)]
          - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)]
        const gy =
          -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)]
          + gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)]
        edges[idx] = Math.sqrt(gx * gx + gy * gy)
      }
    }

    // 归一化边缘
    let maxEdge = 0
    for (let i = 0; i < w * h; i++) {
      if (edges[i] > maxEdge) maxEdge = edges[i]
    }

    // 1px 边缘膨胀（3×3 max pooling）使线条更粗
    const dilated = new Float32Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let maxVal = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const val = edges[(y + ky) * w + (x + kx)]
            if (val > maxVal) maxVal = val
          }
        }
        dilated[y * w + x] = maxVal
      }
    }

    // 基于膨胀后的边缘重新计算最大值
    let maxDilated = 0
    for (let i = 0; i < w * h; i++) {
      if (dilated[i] > maxDilated) maxDilated = dilated[i]
    }

    // 输出 canvas：白色线条在透明背景上
    const outCanvas = document.createElement('canvas')
    outCanvas.width = w
    outCanvas.height = h
    const outCtx = outCanvas.getContext('2d')!
    const outData = outCtx.createImageData(w, h)
    const out = outData.data

    const edgeThreshold = 0.05 // 从 0.08 降低到 0.05，捕获更多边缘细节

    for (let i = 0; i < w * h; i++) {
      const normalizedEdge = maxDilated > 0 ? dilated[i] / maxDilated : 0

      if (normalizedEdge > edgeThreshold) {
        // 白色线条，alpha 与边缘强度成正比（乘数 220 使强边缘接近完全不透明）
        const alpha = Math.min(255, normalizedEdge * 220)
        out[i * 4] = 255     // R
        out[i * 4 + 1] = 255 // G
        out[i * 4 + 2] = 255 // B
        out[i * 4 + 3] = alpha
      } else {
        // 透明
        out[i * 4] = 0
        out[i * 4 + 1] = 0
        out[i * 4 + 2] = 0
        out[i * 4 + 3] = 0
      }
    }

    outCtx.putImageData(outData, 0, 0)
    return outCanvas
  }

  get visible(): boolean {
    return this.group.visible
  }

  set visible(v: boolean) {
    this.group.visible = v
  }

  update(time: number, _dt: number): void {
    if (!this.group.visible) return

    // 轮廓微微浮动
    if (this.silhouetteMesh) {
      this.silhouetteMesh.position.y = 5 + Math.sin(time * 0.3) * 0.5
    }
  }

  dispose(): void {
    this.disposed = true
    if (this.silhouetteTexture) this.silhouetteTexture.dispose()
    this.group.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.geometry.dispose()
        ;(child.material as Material).dispose()
      }
    })
    this.group.parent?.remove(this.group)
  }
}
