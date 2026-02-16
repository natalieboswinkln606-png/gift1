const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

export function drawHandSkeleton(
  canvas: HTMLCanvasElement,
  landmarks: Array<{ x: number; y: number; z: number }>
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  ctx.strokeStyle = '#00ffff'
  ctx.lineWidth = 2
  HAND_CONNECTIONS.forEach(([a, b]) => {
    ctx.beginPath()
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h)
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h)
    ctx.stroke()
  })

  ctx.fillStyle = '#00ffff'
  landmarks.forEach((lm) => {
    ctx.beginPath()
    ctx.arc(lm.x * w, lm.y * h, 2, 0, Math.PI * 2)
    ctx.fill()
  })
}
