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
  private silhouetteCanvas: HTMLCanvasElement | null = null  // Worker 结果 canvas 引用，dispose 时释放
  private maxAnisotropy = 1
  private disposed = false
  private _activeWorker: Worker | null = null

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
  private async loadImageWithRetry(url: string, maxRetries = 2): Promise<HTMLImageElement> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (this.disposed) throw new Error('已销毁，中断加载')
      try {
        const img = new Image()
        // 同域静态资源不需要 crossOrigin，设置后反而触发 CORS 预检失败
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('轮廓图加载超时')), 10000)
          img.onload = () => { clearTimeout(timeoutId); resolve() }
          img.onerror = () => { clearTimeout(timeoutId); reject(new Error('轮廓图加载失败')) }
          img.src = url
        })
        return img
      } catch (e) {
        console.warn(`[SilhouetteDisplay] 加载尝试 ${attempt + 1}/${maxRetries} 失败:`, e)
        if (attempt === maxRetries - 1) throw e
        if (this.disposed) throw new Error('已销毁，中断加载')
        // 指数退避：500ms, 1s
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)))
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

      // 处理图片：颜色翻转 + 边缘检测 + 去背景（Worker 异步执行）
      const processedCanvas = await this.processImageAsync(img)
      if (this.disposed) return

      // 创建纹理和 mesh
      this.silhouetteCanvas = processedCanvas
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
   * 图像处理流水线（Web Worker 异步执行）：
   * 灰度化 → 背景检测 → Sobel 边缘检测 → 膨胀 → 归一化 → 阈值化 → 白色线条
   */
  private processImageAsync(img: HTMLImageElement): Promise<HTMLCanvasElement> {
    // 缩放到合理处理尺寸（1024 保证轮廓纹理清晰度，图片已预压缩到此尺寸）
    const maxDim = 1024
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.floor(img.width * scale)
    const h = Math.floor(img.height * scale)

    // 主线程：创建临时 canvas 提取像素数据
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = w
    srcCanvas.height = h
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.drawImage(img, 0, 0, w, h)
    const imageData = srcCtx.getImageData(0, 0, w, h)
    // 释放源 canvas 内存（不再需要）
    srcCanvas.width = 0
    srcCanvas.height = 0

    // 复制 buffer（原 buffer 属于 ImageData，transfer 后不可用）
    const bufferCopy = imageData.data.buffer.slice(0)

    return new Promise<HTMLCanvasElement>((resolve, reject) => {
      // 终止可能还在运行的旧 Worker，防止泄漏
      this._activeWorker?.terminate()

      const worker = new Worker(
        new URL('../../workers/silhouette.worker.ts', import.meta.url),
        { type: 'module' },
      )
      this._activeWorker = worker

        worker.onmessage = (e: MessageEvent) => {
          const { type, buffer, width, height } = e.data
          if (type !== 'RESULT') return

          // 从 Worker 返回的 ArrayBuffer 构建输出 canvas
          const resultData = new Uint8ClampedArray(buffer)
          const outCanvas = document.createElement('canvas')
          outCanvas.width = width
          outCanvas.height = height
          const outCtx = outCanvas.getContext('2d')!
          const outImageData = new ImageData(resultData, width, height)
          outCtx.putImageData(outImageData, 0, 0)

          worker.terminate()
          this._activeWorker = null
          resolve(outCanvas)
        }

      worker.onerror = (err) => {
        worker.terminate()
        this._activeWorker = null
        reject(err)
      }

      worker.postMessage(
        {
          type: 'PROCESS',
          buffer: bufferCopy,
          width: w,
          height: h,
          bgTolerance: 30,
          edgeThreshold: 0.05,
        },
        { transfer: [bufferCopy] },
      )
    })
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
    // 终止可能还在运行的 Worker
    this._activeWorker?.terminate()
    this._activeWorker = null
    if (this.silhouetteTexture) this.silhouetteTexture.dispose()
    // 释放 Worker 结果 canvas 的 backing store (~4MB for 1024x1024)
    if (this.silhouetteCanvas) {
      this.silhouetteCanvas.width = 0
      this.silhouetteCanvas.height = 0
      this.silhouetteCanvas = null
    }
    this.group.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.geometry.dispose()
        ;(child.material as Material).dispose()
      }
    })
    this.group.parent?.remove(this.group)
  }
}
