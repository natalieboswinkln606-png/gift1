import * as THREE from 'three'

/**
 * 人物轮廓展示系统
 * 1. 加载用户轮廓图 → Canvas 颜色翻转 + 边缘检测 + 去背景 → 白色线条纹理
 * 2. 贴到 3D 平面上，位于两条字幕条中间
 */

const BLOOM_LAYER = 1
const SILHOUETTE_HEIGHT = 40 // 3D 空间中的高度

export class SilhouetteDisplay {
  private group: THREE.Group
  private silhouetteMesh: THREE.Mesh | null = null
  private silhouetteTexture: THREE.CanvasTexture | null = null

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group()
    this.group.visible = false
    scene.add(this.group)
  }

  /**
   * 异步加载并处理轮廓图
   */
  async loadSilhouette(userId: string, silhouettePath: string): Promise<void> {
    if (!silhouettePath) return

    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('轮廓图加载超时')), 10000)
        img.onload = () => { clearTimeout(timeoutId); resolve() }
        img.onerror = () => { clearTimeout(timeoutId); reject(new Error('轮廓图加载失败')) }
        img.src = `/users/${userId}/${silhouettePath}`
      })

      // 处理图片：颜色翻转 + 边缘检测 + 去背景
      const processedCanvas = this.processImage(img)

      // 创建纹理和 mesh
      this.silhouetteTexture = new THREE.CanvasTexture(processedCanvas)
      this.silhouetteTexture.minFilter = THREE.LinearFilter
      this.silhouetteTexture.magFilter = THREE.LinearFilter

      const aspect = processedCanvas.width / processedCanvas.height
      const height = SILHOUETTE_HEIGHT
      const width = height * aspect

      const geo = new THREE.PlaneGeometry(width, height)
      const mat = new THREE.MeshBasicMaterial({
        map: this.silhouetteTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })

      this.silhouetteMesh = new THREE.Mesh(geo, mat)
      this.silhouetteMesh.layers.enable(BLOOM_LAYER)
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
    // 缩放到合理处理尺寸
    const maxDim = 512
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
    const bgTolerance = 40

    // Sobel 边缘检测
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

    // 输出 canvas：白色线条在透明背景上
    const outCanvas = document.createElement('canvas')
    outCanvas.width = w
    outCanvas.height = h
    const outCtx = outCanvas.getContext('2d')!
    const outData = outCtx.createImageData(w, h)
    const out = outData.data

    const edgeThreshold = 0.12 // 边缘阈值

    for (let i = 0; i < w * h; i++) {
      const normalizedEdge = maxEdge > 0 ? edges[i] / maxEdge : 0

      if (normalizedEdge > edgeThreshold) {
        // 白色线条，alpha 与边缘强度成正比
        const alpha = Math.min(255, normalizedEdge * 400)
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
    if (this.silhouetteTexture) this.silhouetteTexture.dispose()
    this.group.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    })
    this.group.parent?.remove(this.group)
  }
}
