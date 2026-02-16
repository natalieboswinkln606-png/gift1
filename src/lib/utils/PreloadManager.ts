import * as THREE from 'three'
import type { UserConfig } from '@/types'

export class PreloadManager {
  private totalItems = 0
  private loadedItems = 0
  private errors: Array<{ url: string; error: unknown }> = []
  private cache: Map<string, unknown> = new Map()
  private textureLoader = new THREE.TextureLoader()
  private onProgress: ((progress: number) => void) | null = null

  setOnProgress(callback: (progress: number) => void): void {
    this.onProgress = callback
  }

  async preloadAll(userConfig: UserConfig): Promise<void> {
    const photoUrls = userConfig.christmasPhotos.map(
      (p) => `/users/${userConfig.identifier}/${p}`
    )

    const allUrls = [...photoUrls]
    this.totalItems = allUrls.length

    // Load textures with concurrency limit
    const batchSize = 4
    for (let i = 0; i < allUrls.length; i += batchSize) {
      const batch = allUrls.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map((url) => this.loadTexture(url))
      )
      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          this.errors.push({ url: batch[idx], error: result.reason })
        }
        this.loadedItems++
        this.emitProgress()
       })
     }
   }

  async loadTexture(url: string): Promise<THREE.Texture> {
    if (this.cache.has(url)) {
      return this.cache.get(url) as THREE.Texture
    }

    return new Promise<THREE.Texture>((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
          texture.minFilter = THREE.LinearFilter
          this.cache.set(url, texture)
          resolve(texture)
        },
        undefined,
        (error) => {
          reject(error)
        }
      )
    })
  }

  async loadImage(url: string): Promise<HTMLImageElement> {
    if (this.cache.has(url)) {
      return this.cache.get(url) as HTMLImageElement
    }

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        this.cache.set(url, img)
        resolve(img)
      }
      img.onerror = reject
      img.src = url
    })
  }

  getFromCache<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined
  }

  getProgress(): number {
    if (this.totalItems === 0) return 100
    return Math.round((this.loadedItems / this.totalItems) * 100)
  }

  isComplete(): boolean {
    return this.loadedItems >= this.totalItems
  }

  getErrors(): Array<{ url: string; error: unknown }> {
    return this.errors
  }

  private emitProgress(): void {
    this.onProgress?.(this.getProgress())
  }

  dispose(): void {
    this.cache.forEach((value) => {
      if (value instanceof THREE.Texture) {
        value.dispose()
      }
    })
    this.cache.clear()
  }
}
