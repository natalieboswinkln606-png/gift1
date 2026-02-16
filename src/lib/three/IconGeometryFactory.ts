import * as THREE from 'three'

export type IconType =
  | 'giftBoxWithBow' | 'wrappedPresent' | 'giftBag'
  | 'stackedGifts' | 'openGiftBox' | 'giftWithSparkles'
  | 'ribbonBow' | 'presentWithTag' | 'festiveGift'
  | 'chineseLantern' | 'goldCoin' | 'redEnvelope'
  | 'fireworkBurst' | 'luckyStar' | 'fortuneCookie'

export const ICON_TYPES: IconType[] = [
  'giftBoxWithBow', 'wrappedPresent', 'giftBag',
  'stackedGifts', 'openGiftBox', 'giftWithSparkles',
  'ribbonBow', 'presentWithTag', 'festiveGift',
  'chineseLantern', 'goldCoin', 'redEnvelope',
  'fireworkBurst', 'luckyStar', 'fortuneCookie',
]

const DS = THREE.DoubleSide

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1, ...opts })
}

function goldMat(opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return mat(0xffd700, { roughness: 0.3, metalness: 0.6, ...opts })
}

export class IconGeometryFactory {
  private static trackedTextures: THREE.Texture[] = []
  private static trackedMaterials: THREE.Material[] = []
  private static trackedGeometries: THREE.BufferGeometry[] = []

  static getAllTypes(): IconType[] { return [...ICON_TYPES] }

  private static trackMaterial(material: THREE.Material): THREE.Material {
    IconGeometryFactory.trackedMaterials.push(material)
    return material
  }

  private static trackGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    IconGeometryFactory.trackedGeometries.push(geometry)
    return geometry
  }

  private static trackTexture(texture: THREE.Texture): THREE.Texture {
    IconGeometryFactory.trackedTextures.push(texture)
    return texture
  }

  private static createMaterial(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
    return IconGeometryFactory.trackMaterial(mat(color, opts)) as THREE.MeshStandardMaterial
  }

  private static createGoldMaterial(opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
    return IconGeometryFactory.trackMaterial(goldMat(opts)) as THREE.MeshStandardMaterial
  }

  static dispose(): void {
    IconGeometryFactory.trackedTextures.forEach(t => t.dispose())
    IconGeometryFactory.trackedMaterials.forEach(m => m.dispose())
    IconGeometryFactory.trackedGeometries.forEach(g => g.dispose())
    IconGeometryFactory.trackedTextures = []
    IconGeometryFactory.trackedMaterials = []
    IconGeometryFactory.trackedGeometries = []
  }

  static createIcon(type: IconType): THREE.Group {
    switch (type) {
      case 'giftBoxWithBow': return this.giftBoxWithBow()
      case 'wrappedPresent': return this.wrappedPresent()
      case 'giftBag': return this.giftBag()
      case 'stackedGifts': return this.stackedGifts()
      case 'openGiftBox': return this.openGiftBox()
      case 'giftWithSparkles': return this.giftWithSparkles()
      case 'ribbonBow': return this.ribbonBow()
      case 'presentWithTag': return this.presentWithTag()
      case 'festiveGift': return this.festiveGift()
      case 'chineseLantern': return this.chineseLantern()
      case 'goldCoin': return this.goldCoin()
      case 'redEnvelope': return this.redEnvelope()
      case 'fireworkBurst': return this.fireworkBurst()
      case 'luckyStar': return this.luckyStar()
      case 'fortuneCookie': return this.fortuneCookie()
      default: return this.giftBoxWithBow()
    }
  }

  // ─── 1. Gift Box with Bow ───
  private static giftBoxWithBow(): THREE.Group {
    const g = new THREE.Group()
    const boxMat = IconGeometryFactory.createMaterial(0xff3333)
    const rMat = IconGeometryFactory.createGoldMaterial()

    // Box body
    g.add(new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.8, 0.8, 0.8)), boxMat))

    // Vertical ribbon
    const vr = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.08, 0.85, 0.08)), rMat)
    vr.position.set(0, 0, 0.42)
    g.add(vr)

    // Horizontal ribbon
    const hr = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.85, 0.08, 0.08)), rMat)
    hr.position.set(0, 0.42, 0)
    g.add(hr)

    // Bow loops
    const loopG = IconGeometryFactory.trackGeometry(new THREE.TorusGeometry(0.18, 0.04, 8, 12, Math.PI))
    const l1 = new THREE.Mesh(loopG, rMat)
    l1.position.set(-0.12, 0.48, 0)
    l1.rotation.set(0, Math.PI / 2, Math.PI / 4)
    g.add(l1)

    const l2 = new THREE.Mesh(loopG, rMat)
    l2.position.set(0.12, 0.48, 0)
    l2.rotation.set(0, Math.PI / 2, -Math.PI / 4)
    g.add(l2)

    // Bow knot
    const knot = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.SphereGeometry(0.07, 8, 8)), rMat)
    knot.position.y = 0.48
    g.add(knot)

    return g
  }

  // ─── 2. Wrapped Present ───
  private static wrappedPresent(): THREE.Group {
    const g = new THREE.Group()
    const boxMat = IconGeometryFactory.createMaterial(0x8b4513, { roughness: 0.6 })
    const rMat = IconGeometryFactory.createMaterial(0xcc0000, { roughness: 0.3, metalness: 0.4 })

    g.add(new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.7, 0.9, 0.7)), boxMat))

    // Side ribbons
    const rg = IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.06, 0.95, 0.06))
    const positions = [[0.36, 0, 0], [-0.36, 0, 0], [0, 0, 0.36], [0, 0, -0.36]] as const
    positions.forEach(([x, y, z]) => {
      const r = new THREE.Mesh(rg, rMat)
      r.position.set(x, y, z)
      g.add(r)
    })

    // Top cross
    const tc = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.75, 0.06, 0.06)), rMat)
    tc.position.y = 0.48
    g.add(tc)

    return g
  }

  // ─── 3. Gift Bag ───
  private static giftBag(): THREE.Group {
    const g = new THREE.Group()
    const bagMat = IconGeometryFactory.createMaterial(0x20b2aa, { roughness: 0.5 })
    const tissueMat = IconGeometryFactory.createMaterial(0xff69b4, { roughness: 0.8, metalness: 0, side: DS })

    g.add(new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.7, 0.9, 0.4)), bagMat))

    // Handles
    const hg = IconGeometryFactory.trackGeometry(new THREE.TorusGeometry(0.12, 0.025, 8, 12, Math.PI))
    const h1 = new THREE.Mesh(hg, bagMat)
    h1.position.set(-0.15, 0.5, 0)
    h1.rotation.z = Math.PI
    g.add(h1)
    const h2 = new THREE.Mesh(hg, bagMat)
    h2.position.set(0.15, 0.5, 0)
    h2.rotation.z = Math.PI
    g.add(h2)

    // Tissue paper
    const tg = IconGeometryFactory.trackGeometry(new THREE.PlaneGeometry(0.35, 0.4))
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(tg, tissueMat)
      t.position.set((Math.random() - 0.5) * 0.15, 0.55 + i * 0.08, 0)
      t.rotation.set(Math.random() * 0.4, Math.random() * Math.PI * 2, Math.random() * 0.4)
      g.add(t)
    }

    return g
  }

  // ─── 4. Stacked Gifts ───
  private static stackedGifts(): THREE.Group {
    const g = new THREE.Group()
    const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d]
    const sizes = [
      { w: 0.8, h: 0.35, d: 0.8 },
      { w: 0.6, h: 0.3, d: 0.6 },
      { w: 0.45, h: 0.25, d: 0.45 },
    ]
    const rMat = IconGeometryFactory.createGoldMaterial()
    let yOff = -0.35

    sizes.forEach((s, i) => {
      const box = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(s.w, s.h, s.d)), IconGeometryFactory.createMaterial(colors[i]))
      box.position.y = yOff + s.h / 2
      g.add(box)

      const ribbon = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.06, s.h + 0.02, 0.06)), rMat)
      ribbon.position.set(0, yOff + s.h / 2, s.d / 2 + 0.01)
      g.add(ribbon)

      yOff += s.h
    })

    return g
  }

  // ─── 5. Open Gift Box ───
  private static openGiftBox(): THREE.Group {
    const g = new THREE.Group()
    const m = IconGeometryFactory.createMaterial(0xf5f5f5, { roughness: 0.5, side: DS })

    // Base
    const base = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.7, 0.08, 0.7)), m)
    base.position.y = -0.3
    g.add(base)

    // Walls
    const wg = IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.7, 0.5, 0.06))
    const walls = [
      { pos: [0, -0.05, 0.35], rot: [0, 0, 0] },
      { pos: [0, -0.05, -0.35], rot: [0, 0, 0] },
      { pos: [0.35, -0.05, 0], rot: [0, Math.PI / 2, 0] },
      { pos: [-0.35, -0.05, 0], rot: [0, Math.PI / 2, 0] },
    ] as const
    walls.forEach(({ pos, rot }) => {
      const w = new THREE.Mesh(wg, m)
      w.position.set(pos[0], pos[1], pos[2])
      w.rotation.set(rot[0], rot[1], rot[2])
      g.add(w)
    })

    // Lid (tilted back)
    const lid = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.75, 0.08, 0.75)), m)
    lid.position.set(0, 0.3, -0.3)
    lid.rotation.x = -Math.PI / 4
    g.add(lid)

    return g
  }

  // ─── 6. Gift with Sparkles ───
  private static giftWithSparkles(): THREE.Group {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.7, 0.7, 0.7)), IconGeometryFactory.createMaterial(0xdc143c, { roughness: 0.3, metalness: 0.2 })))

    const ribbon = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.06, 0.75, 0.06)), IconGeometryFactory.createGoldMaterial())
    ribbon.position.z = 0.38
    g.add(ribbon)

    // Sparkles
    const sg = IconGeometryFactory.trackGeometry(new THREE.IcosahedronGeometry(0.07, 0))
    const sm = IconGeometryFactory.createMaterial(0xffd700, { emissive: 0xffaa00, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.9 })
    const positions = [
      [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5], [0, 0.6, 0], [0, -0.6, 0],
    ] as const
    positions.forEach(([x, y, z]) => {
      const s = new THREE.Mesh(sg, sm)
      s.position.set(x, y, z)
      s.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      g.add(s)
    })

    return g
  }

  // ─── 7. Ribbon Bow ───
  private static ribbonBow(): THREE.Group {
    const g = new THREE.Group()
    const m = IconGeometryFactory.createMaterial(0xff1493, { roughness: 0.3, metalness: 0.4 })

    const loopG = IconGeometryFactory.trackGeometry(new THREE.TorusGeometry(0.28, 0.07, 8, 12, Math.PI))
    const l1 = new THREE.Mesh(loopG, m)
    l1.position.x = -0.18
    l1.rotation.set(0, Math.PI / 2, Math.PI / 6)
    g.add(l1)

    const l2 = new THREE.Mesh(loopG, m)
    l2.position.x = 0.18
    l2.rotation.set(0, Math.PI / 2, -Math.PI / 6)
    g.add(l2)

    g.add(new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.SphereGeometry(0.1, 10, 10)), m))

    // Tails
    const tg = IconGeometryFactory.trackGeometry(new THREE.CylinderGeometry(0.05, 0.02, 0.45, 8))
    const t1 = new THREE.Mesh(tg, m)
    t1.position.set(-0.12, -0.32, 0)
    t1.rotation.z = Math.PI / 8
    g.add(t1)
    const t2 = new THREE.Mesh(tg, m)
    t2.position.set(0.12, -0.32, 0)
    t2.rotation.z = -Math.PI / 8
    g.add(t2)

    return g
  }

  // ─── 8. Present with Tag ───
  private static presentWithTag(): THREE.Group {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.75, 0.6, 0.75)), IconGeometryFactory.createMaterial(0x9370db)))

    const rMat = IconGeometryFactory.createGoldMaterial()
    const vr = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.06, 0.65, 0.06)), rMat)
    vr.position.z = 0.38
    g.add(vr)
    const hr = new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.78, 0.06, 0.06)), rMat)
    hr.position.y = 0.32
    g.add(hr)

    // Tag
    const tag = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.PlaneGeometry(0.22, 0.14)),
      IconGeometryFactory.createMaterial(0xfffacd, { roughness: 0.7, metalness: 0, side: DS })
    )
    tag.position.set(0.45, 0.38, 0.38)
    tag.rotation.set(0.3, -0.5, 0.2)
    g.add(tag)

    return g
  }

  // ─── 9. Festive Gift ───
  private static festiveGift(): THREE.Group {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.8, 0.7, 0.8)), IconGeometryFactory.createMaterial(0xffffff, { roughness: 0.5 })))

    const colors = [0xff0000, 0x00cc00, 0x0066ff, 0xffcc00]
    const rg = IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.05, 0.75, 0.05))
    colors.forEach((c, i) => {
      const angle = (i / colors.length) * Math.PI * 2
      const r = new THREE.Mesh(rg, IconGeometryFactory.createMaterial(c, { roughness: 0.3, metalness: 0.5 }))
      r.position.set(Math.cos(angle) * 0.42, 0, Math.sin(angle) * 0.42)
      g.add(r)
    })

    const bow = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.TorusGeometry(0.18, 0.05, 8, 12)),
      IconGeometryFactory.createMaterial(0xff69b4, { roughness: 0.3, metalness: 0.4 })
    )
    bow.position.y = 0.42
    bow.rotation.x = Math.PI / 2
    g.add(bow)

    return g
  }

  // ─── 10. Chinese Lantern ───
  private static chineseLantern(): THREE.Group {
    const g = new THREE.Group()

    // Lantern body (lathe)
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const r = 0.22 + Math.sin(t * Math.PI) * 0.14
      pts.push(new THREE.Vector2(r, t * 0.75 - 0.375))
    }
    const body = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.LatheGeometry(pts, 20)),
      IconGeometryFactory.createMaterial(0xff0000, { emissive: 0x330000, emissiveIntensity: 0.3, roughness: 0.6 })
    )
    g.add(body)

    // Caps
    const capG = IconGeometryFactory.trackGeometry(new THREE.CylinderGeometry(0.13, 0.16, 0.06, 20))
    const capM = IconGeometryFactory.createGoldMaterial({ metalness: 0.8 })
    const topCap = new THREE.Mesh(capG, capM)
    topCap.position.y = 0.4
    g.add(topCap)
    const botCap = new THREE.Mesh(capG, capM)
    botCap.position.y = -0.4
    g.add(botCap)

    // Tassels
    const tg = IconGeometryFactory.trackGeometry(new THREE.CylinderGeometry(0.01, 0.018, 0.22, 6))
    const tm = IconGeometryFactory.createGoldMaterial({ roughness: 0.4 })
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const t = new THREE.Mesh(tg, tm)
      t.position.set(Math.cos(a) * 0.1, -0.55, Math.sin(a) * 0.1)
      g.add(t)
    }

    return g
  }

  // ─── 11. Gold Coin ───
  private static goldCoin(): THREE.Group {
    const g = new THREE.Group()

    const coin = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.CylinderGeometry(0.35, 0.35, 0.07, 28)),
      IconGeometryFactory.createGoldMaterial({ metalness: 0.9, roughness: 0.2, emissive: 0x332200, emissiveIntensity: 0.2 })
    )
    coin.rotation.x = Math.PI / 2
    g.add(coin)

    // Rim
    const rim = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.TorusGeometry(0.35, 0.035, 12, 28)),
      IconGeometryFactory.createMaterial(0xb8860b, { roughness: 0.3, metalness: 0.8 })
    )
    rim.rotation.x = Math.PI / 2
    g.add(rim)

    // 福 character
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#8b0000'
    ctx.font = 'bold 90px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('福', 64, 64)

    const charTexture = IconGeometryFactory.trackTexture(new THREE.CanvasTexture(canvas))
    canvas.width = 0; canvas.height = 0
    const charMesh = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.PlaneGeometry(0.45, 0.45)),
      IconGeometryFactory.trackMaterial(new THREE.MeshStandardMaterial({
        map: charTexture,
        transparent: true, roughness: 0.8, metalness: 0,
      })) as THREE.Material
    )
    charMesh.position.z = 0.04
    g.add(charMesh)

    return g
  }

  // ─── 12. Red Envelope ───
  private static redEnvelope(): THREE.Group {
    const g = new THREE.Group()

    // Body
    g.add(new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.BoxGeometry(0.55, 0.85, 0.03)),
      IconGeometryFactory.createMaterial(0xcc0000, { roughness: 0.5, metalness: 0.2 })
    ))

    // Flap
    const flap = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.PlaneGeometry(0.55, 0.25)),
      IconGeometryFactory.createMaterial(0xaa0000, { roughness: 0.5, metalness: 0.2, side: DS })
    )
    flap.position.set(0, 0.35, 0.05)
    flap.rotation.x = -Math.PI / 6
    g.add(flap)

    // Gold text
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 200
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 50px serif'
    ctx.textAlign = 'center'
    ctx.fillText('恭喜', 64, 70)
    ctx.fillText('发财', 64, 140)

    const textTexture = IconGeometryFactory.trackTexture(new THREE.CanvasTexture(canvas))
    canvas.width = 0; canvas.height = 0
    const textMesh = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.PlaneGeometry(0.35, 0.55)),
      IconGeometryFactory.trackMaterial(new THREE.MeshStandardMaterial({
        map: textTexture,
        transparent: true, roughness: 0.3, metalness: 0.5,
      })) as THREE.Material
    )
    textMesh.position.z = 0.02
    g.add(textMesh)

    return g
  }

  // ─── 13. Firework Burst ───
  private static fireworkBurst(): THREE.Group {
    const g = new THREE.Group()

    // Core
    g.add(new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.SphereGeometry(0.07, 10, 10)),
      IconGeometryFactory.createMaterial(0xffffff, { emissive: 0xffff00, emissiveIntensity: 1, roughness: 0.1, metalness: 0.9 })
    ))

    // Sparkle rays
    const sg = IconGeometryFactory.trackGeometry(new THREE.IcosahedronGeometry(0.055, 0))
    const colors = [0xff0000, 0x00ff00, 0x0066ff, 0xffff00, 0xff00ff, 0x00ffff]
    for (let i = 0; i < 12; i++) {
      const phi = Math.acos(-1 + (2 * i) / 12)
      const theta = Math.sqrt(12 * Math.PI) * i
      const sm = IconGeometryFactory.createMaterial(colors[i % 6], {
        emissive: colors[i % 6], emissiveIntensity: 0.6,
        roughness: 0.2, metalness: 0.8,
      })
      const s = new THREE.Mesh(sg, sm)
      s.position.set(
        0.28 * Math.sin(phi) * Math.cos(theta),
        0.28 * Math.sin(phi) * Math.sin(theta),
        0.28 * Math.cos(phi),
      )
      g.add(s)
    }

    return g
  }

  // ─── 14. Lucky Star ───
  private static luckyStar(): THREE.Group {
    const g = new THREE.Group()

    // 5-pointed star shape
    const shape = new THREE.Shape()
    const outerR = 0.38
    const innerR = 0.16
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? outerR : innerR
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    shape.closePath()

    const star = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.ExtrudeGeometry(shape, {
        depth: 0.14, bevelEnabled: true,
        bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2,
      })),
      IconGeometryFactory.createMaterial(0xffff00, { emissive: 0xffaa00, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.7 })
    )
    star.rotation.x = Math.PI / 2
    star.position.z = -0.07
    g.add(star)

    // Center glow
    g.add(new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.IcosahedronGeometry(0.1, 1)),
      IconGeometryFactory.createMaterial(0xffffff, { emissive: 0xffff00, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.9 })
    ))

    return g
  }

  // ─── 15. Fortune Cookie ───
  private static fortuneCookie(): THREE.Group {
    const g = new THREE.Group()

    // Cookie body (partial torus)
    const cookie = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.TorusGeometry(0.28, 0.13, 12, 20, Math.PI * 1.4)),
      IconGeometryFactory.createMaterial(0xf4e4c1, { roughness: 0.7, metalness: 0.05 })
    )
    cookie.rotation.set(Math.PI / 2, 0, Math.PI / 4)
    g.add(cookie)

    // Fortune paper strip
    const paper = new THREE.Mesh(
      IconGeometryFactory.trackGeometry(new THREE.PlaneGeometry(0.12, 0.35)),
      IconGeometryFactory.createMaterial(0xffffff, { roughness: 0.8, metalness: 0, side: DS })
    )
    paper.position.set(0, 0.08, 0)
    paper.rotation.set(0.3, 0.2, 0)
    g.add(paper)

    return g
  }
}
