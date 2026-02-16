import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { UserConfig } from '@/types'

export class PhotoSystem {
  photos: THREE.Mesh[] = []
  photoGroup: THREE.Group
  activePhoto: THREE.Mesh | null = null
  private scene: THREE.Scene
  private vTmp = new THREE.Vector3()
  private hudTmp = new THREE.Vector3()
  private localTmp = new THREE.Vector3()
  private treeHeight = 85
  private treeRadius = 35
  private photoIndex = 0
  private totalPhotos = 0
  private disposed = false

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.photoGroup = new THREE.Group()
    scene.add(this.photoGroup)
  }

  async loadFromConfig(config: UserConfig, userId: string): Promise<void> {
    if (!config.christmasPhotos?.length) return
    const loader = new THREE.TextureLoader()
    const promises = config.christmasPhotos.map((photoPath) => {
      const url = `/users/${userId}/${photoPath}`
      return new Promise<THREE.Texture>((resolve) => {
        loader.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace
            tex.minFilter = THREE.LinearMipmapLinearFilter
            tex.magFilter = THREE.LinearFilter
            tex.anisotropy = 16
            tex.generateMipmaps = true
            resolve(tex)
          },
          undefined,
          () => {
            console.warn(`[PhotoSystem] Failed to load photo: ${url}`)
            resolve(null as unknown as THREE.Texture)
          }
        )
      })
    })

    const textures = await Promise.all(promises)
    const validTextures = textures.filter((tex) => tex !== null)
    if (this.disposed) return
    this.totalPhotos = validTextures.length
    this.photoIndex = 0
    validTextures.forEach((tex) => {
      this.addPhoto(tex)
    })
  }

  addPhoto(tex: THREE.Texture): void {
    const aspect = tex.image.width / tex.image.height
    const h = 7
    const w = h * aspect

    // Frame
    const frameGeo = new THREE.PlaneGeometry(w + 0.4, h + 1.0)
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide })
    const frame = new THREE.Mesh(frameGeo, frameMat)

    // Photo
    const pGeo = new THREE.PlaneGeometry(w, h)
    const pMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false })
    const pMesh = new THREE.Mesh(pGeo, pMat)
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
      treePos: new THREE.Vector3(tr * Math.cos(ta), th, tr * Math.sin(ta)),
      treeRot: new THREE.Euler(0, -ta + Math.PI / 2, 0),
      scatterRadius: sr,
      scatterAngle: sa,
      scatterY: ((idx / n) - 0.5) * 10, // evenly spread vertically too
      selfRotSpeed: (((idx % 3) - 1) * 0.01) + 0.005,
    }

    this.photoGroup.add(frame)
    this.photos.push(frame)
    this.photoIndex++
  }

  setActivePhoto(photo: THREE.Mesh | null): void {
    this.activePhoto = photo
  }

  hasActivePhoto(): boolean {
    return this.activePhoto !== null
  }

  closeActivePhoto(): void {
    this.activePhoto = null
  }

  /** Return all photo frame meshes (and their children) for raycasting */
  getAllRaycastTargets(): THREE.Object3D[] {
    const targets: THREE.Object3D[] = []
    this.photos.forEach((frame) => {
      targets.push(frame)
      frame.children.forEach((child) => targets.push(child))
    })
    return targets
  }

  /** Find the parent frame mesh for a raycasted object (could be the photo child) */
  findFrameForObject(obj: THREE.Object3D): THREE.Mesh | null {
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

  update(time: number, isTree: boolean, camera: THREE.Camera, controls: OrbitControls): void {
    // Compute HUD world position: 30 units in front of camera
    const hudWorldPos = this.hudTmp.set(0, 0, -30).applyMatrix4(camera.matrixWorld)

    this.photos.forEach((p) => {
      const photoMesh = p.children[0] as THREE.Mesh | undefined

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
        ;(p.material as THREE.Material).depthTest = false

        if (photoMesh) {
          photoMesh.renderOrder = 10000
          ;(photoMesh.material as THREE.Material).depthTest = false
        }
      } else {
        if (!this.activePhoto) controls.enabled = true

        // Restore normal render order
        p.renderOrder = 0
        ;(p.material as THREE.Material).depthTest = true
        if (photoMesh) {
          photoMesh.renderOrder = 0
          ;(photoMesh.material as THREE.Material).depthTest = true
        }

        p.scale.lerp(this.vTmp.set(1, 1, 1), 0.1)

        if (isTree) {
          p.position.lerp(p.userData.treePos, 0.1)
          const rot = p.userData.treeRot
          p.rotation.set(rot.x, rot.y, rot.z)
        } else {
          const r = p.userData.scatterRadius
          const a = p.userData.scatterAngle
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
      ;(frame.material as THREE.Material).dispose()
      frame.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          const mat = child.material as THREE.MeshBasicMaterial
          mat.map?.dispose()
          mat.dispose()
        }
      })
    })
    this.photos = []
    this.scene.remove(this.photoGroup)
  }
}
