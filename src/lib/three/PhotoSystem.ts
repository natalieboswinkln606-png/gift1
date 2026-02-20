import {
  Camera,
  DoubleSide,
  Euler,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  Texture,
  TextureLoader,
  Vector3,
} from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { UserConfig } from '@/types'

export class PhotoSystem {
  photos: Mesh[] = []
  photoGroup: Group
  activePhoto: Mesh | null = null
  private scene: Scene
  private vTmp = new Vector3()
  private hudTmp = new Vector3()
  private localTmp = new Vector3()
  private treeHeight = 85
  private treeRadius = 35
  private photoIndex = 0
  private totalPhotos = 0
  private disposed = false

  constructor(scene: Scene) {
    this.scene = scene
    this.photoGroup = new Group()
    scene.add(this.photoGroup)
  }

  async loadFromConfig(config: UserConfig, userId: string): Promise<void> {
    if (!config.christmasPhotos?.length) return
    const loader = new TextureLoader()
    const promises = config.christmasPhotos.map((photoPath) => {
      const url = `/users/${userId}/${photoPath}`
      return new Promise<Texture | null>((resolve) => {
        if (this.disposed) { resolve(null); return }
        loader.load(
          url,
          (tex) => {
            if (this.disposed) { tex.dispose(); resolve(null); return }
            // 限制纹理最大尺寸为 2048px，减少 GPU 显存占用（4K 照片 ~32MB → 2048 ~16MB）
            const maxSize = 2048
            const img = tex.image as HTMLImageElement
            if (img.width > maxSize || img.height > maxSize) {
              const scale = maxSize / Math.max(img.width, img.height)
              const w = Math.floor(img.width * scale)
              const h = Math.floor(img.height * scale)
              const canvas = document.createElement('canvas')
              canvas.width = w
              canvas.height = h
              const ctx = canvas.getContext('2d')!
              ctx.drawImage(img, 0, 0, w, h)
              tex.image = canvas
              tex.needsUpdate = true
            }
            tex.colorSpace = SRGBColorSpace
            tex.minFilter = LinearMipmapLinearFilter
            tex.magFilter = LinearFilter
            tex.anisotropy = Math.min(4, 16)  // 限制 anisotropy 为 4，减少 GPU 采样开销
            tex.generateMipmaps = true
            resolve(tex)
          },
          undefined,
          () => {
            console.warn(`[PhotoSystem] Failed to load photo: ${url}`)
            resolve(null)
          }
        )
      })
    })

    const textures = await Promise.all(promises)
    const validTextures = textures.filter((tex): tex is Texture => tex !== null)
    if (this.disposed) return
    this.totalPhotos = validTextures.length
    this.photoIndex = 0
    validTextures.forEach((tex) => {
      this.addPhoto(tex)
    })
  }

  addPhoto(tex: Texture): void {
    const aspect = tex.image.width / tex.image.height
    const h = 7
    const w = h * aspect

    // Frame
    const frameGeo = new PlaneGeometry(w + 0.4, h + 1.0)
    const frameMat = new MeshBasicMaterial({ color: 0x222222, side: DoubleSide })
    const frame = new Mesh(frameGeo, frameMat)

    // Photo
    const pGeo = new PlaneGeometry(w, h)
    const pMat = new MeshBasicMaterial({ map: tex, side: DoubleSide, toneMapped: false })
    const pMesh = new Mesh(pGeo, pMat)
    pMesh.position.set(0, 0.3, 0.05)
    frame.add(pMesh)

    // Uniform distribution using golden angle to avoid clustering
    const n = this.totalPhotos || 1
    const idx = this.photoIndex
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // ~137.5 degrees

    // --- TREE mode: evenly distribute along tree height with golden angle ---
    // Height: evenly spaced from 8 to 0.75*treeHeight, with small jitter
    const hFrac = (idx + 0.5) / n // 0..1 centered in each slot
    const th = 8 + hFrac * (this.treeHeight * 0.75 - 8)
    const ta = idx * goldenAngle // golden angle ensures no clustering
    const layerMod = 1.0 + 0.3 * Math.sin(th * 0.8)
    const tr = this.treeRadius * (1 - th / this.treeHeight) * layerMod + 3.0

    // --- SCATTER mode: evenly distribute in radius and angle ---
    const scatterMinR = 30
    const scatterMaxR = 90
    const sFrac = (idx + 0.5) / n
    const sr = scatterMinR + sFrac * (scatterMaxR - scatterMinR)
    const sa = idx * goldenAngle

    frame.userData = {
      treePos: new Vector3(tr * Math.cos(ta), th, tr * Math.sin(ta)),
      treeRot: new Euler(0, -ta + Math.PI / 2, 0),
      scatterRadius: sr,
      scatterAngle: sa,
      scatterY: ((idx / n) - 0.5) * 10, // evenly spread vertically too
      selfRotSpeed: (((idx % 3) - 1) * 0.01) + 0.005,
    }

    this.photoGroup.add(frame)
    this.photos.push(frame)
    this.photoIndex++
  }

  setActivePhoto(photo: Mesh | null): void {
    this.activePhoto = photo
  }

  hasActivePhoto(): boolean {
    return this.activePhoto !== null
  }

  closeActivePhoto(): void {
    this.activePhoto = null
  }

  /** Return all photo frame meshes (and their children) for raycasting */
  getAllRaycastTargets(): Object3D[] {
    const targets: Object3D[] = []
    this.photos.forEach((frame) => {
      targets.push(frame)
      frame.children.forEach((child) => targets.push(child))
    })
    return targets
  }

  /** Find the parent frame mesh for a raycasted object (could be the photo child) */
  findFrameForObject(obj: Object3D): Mesh | null {
    for (const frame of this.photos) {
      if (obj === frame) return frame
      if (frame.children.includes(obj)) return frame
    }
    return null
  }

  nextPhoto(): void {
    if (this.photos.length === 0) return
    if (!this.activePhoto) {
      this.activePhoto = this.photos[0]
      return
    }
    const idx = this.photos.indexOf(this.activePhoto)
    this.activePhoto = this.photos[(idx + 1) % this.photos.length]
  }

  prevPhoto(): void {
    if (this.photos.length === 0) return
    if (!this.activePhoto) {
      this.activePhoto = this.photos[0]
      return
    }
    const idx = this.photos.indexOf(this.activePhoto)
    this.activePhoto = this.photos[(idx - 1 + this.photos.length) % this.photos.length]
  }

  update(time: number, isTree: boolean, camera: Camera, controls: OrbitControls): void {
    // Compute HUD world position: 30 units in front of camera
    const hudWorldPos = this.hudTmp.set(0, 0, -30).applyMatrix4(camera.matrixWorld)

    this.photos.forEach((p) => {
      const photoMesh = p.children[0] as Mesh | undefined

      if (p === this.activePhoto && !isTree) {
        // Active photo in SCATTER mode: move to camera front
        controls.enabled = false
        const localTarget = this.photoGroup.worldToLocal(this.localTmp.copy(hudWorldPos))

        // Floating effect
        localTarget.y += Math.sin(time * 2.0) * 0.5

        p.position.lerp(localTarget, 0.3)
        p.lookAt(camera.position)
        p.scale.lerp(this.vTmp.set(3.5, 3.5, 3.5), 0.1)

        // Elevate render order and disable depth test so photo is always on top
        p.renderOrder = 9999
        ;(p.material as Material).depthTest = false

        if (photoMesh) {
          photoMesh.renderOrder = 10000
          ;(photoMesh.material as Material).depthTest = false
        }
      } else {
        if (!this.activePhoto) controls.enabled = true

        // Restore normal render order
        p.renderOrder = 0
        ;(p.material as Material).depthTest = true
        if (photoMesh) {
          photoMesh.renderOrder = 0
          ;(photoMesh.material as Material).depthTest = true
        }

        p.scale.lerp(this.vTmp.set(1, 1, 1), 0.1)

        if (isTree) {
          p.position.lerp(p.userData.treePos, 0.1)
          const rot = p.userData.treeRot
          p.rotation.set(rot.x, rot.y, rot.z)
        } else {
          // 星璇模式：照片随粒子公转（角度随时间变化）+ 保留自转
          const r = p.userData.scatterRadius
          const baseAngle = p.userData.scatterAngle as number
          const orbitSpeed = 0.15  // 公转速度，与粒子 shear 旋转协调
          const a = baseAngle + time * orbitSpeed
          p.position.lerp(
            this.vTmp.set(
              r * Math.cos(a),
              p.userData.scatterY + Math.sin(time + p.id) * 2,
              r * Math.sin(a)
            ),
            0.1
          )
          p.rotation.y += p.userData.selfRotSpeed
        }
      }
    })
  }

  dispose(): void {
    this.disposed = true
    this.photos.forEach((frame) => {
      frame.geometry.dispose()
      ;(frame.material as Material).dispose()
      frame.children.forEach((child) => {
        if (child instanceof Mesh) {
          child.geometry.dispose()
          const mat = child.material as MeshBasicMaterial
          mat.map?.dispose()
          mat.dispose()
        }
      })
    })
    this.photos = []
    this.scene.remove(this.photoGroup)
  }
}
