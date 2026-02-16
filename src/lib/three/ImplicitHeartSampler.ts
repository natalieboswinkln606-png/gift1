import * as THREE from 'three'

/**
 * Generate heart-shaped positions using implicit surface sampling.
 * Heart equation: (x² + 2.25z² + y² - 1)³ - x²y³ - 0.1125z²y³ < 0
 */
export function generateChristmasHeartPositions(count: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = []
  const scale = 14
  const yOffset = 45

  while (positions.length < count) {
    const x = Math.random() * 3 - 1.5
    const y = Math.random() * 3 - 1.5
    const z = Math.random() * 3 - 1.5

    const x2 = x * x
    const y2 = y * y
    const z2 = z * z
    const a = x2 + 2.25 * z2 + y2 - 1
    const b = x2 * y2 * y + 0.1125 * z2 * y2 * y

    if (a * a * a - b < 0) {
      positions.push(
        new THREE.Vector3(
          x * scale,
          y * scale + yOffset,
          z * scale
        )
      )
    }
  }

  return positions
}
