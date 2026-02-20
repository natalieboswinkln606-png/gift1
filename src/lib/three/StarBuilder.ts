import {
  Color, ExtrudeGeometry, Material, MathUtils,
  Mesh, MeshBasicMaterial, Scene, Shape, Vector3,
} from 'three'
import { BLOOM_LAYER } from './SelectiveBloom'

export class StarBuilder {
  mesh: Mesh
  private vTmp = new Vector3()

  constructor(scene: Scene) {
    const starShape = new Shape()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 4.0 : 1.8
      const a = (i / 5) * Math.PI
      starShape.lineTo(Math.sin(a) * r, Math.cos(a) * r)
    }

    const starGeo = new ExtrudeGeometry(starShape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelThickness: 0.4,
    })

    const starColor = new Color(0xffaa00)
    starColor.multiplyScalar(1.2)

    const starMat = new MeshBasicMaterial({ color: starColor, toneMapped: false })
    this.mesh = new Mesh(starGeo, starMat)
    this.mesh.layers.enable(BLOOM_LAYER)
    scene.add(this.mesh)
  }

  update(time: number, isTree: boolean, treeHeight: number): void {
    this.mesh.rotation.y = time
    this.mesh.position.lerp(this.vTmp.set(0, isTree ? treeHeight + 1.5 : 0, 0), 0.1)
    this.mesh.scale.setScalar(MathUtils.lerp(this.mesh.scale.x, isTree ? 1.0 : 0.01, 0.1))
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as Material).dispose()
    this.mesh.removeFromParent()
  }
}
