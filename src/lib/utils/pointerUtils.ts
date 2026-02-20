import type { MouseEvent, TouchEvent } from 'react'

/**
 * 统一解析 mouse/touch 事件的客户端坐标。
 * 无 touch 时返回 null。
 */
export function getPointerCoords(
  e: MouseEvent | TouchEvent
): { clientX: number; clientY: number } | null {
  if ('touches' in e) {
    if (!e.touches.length) return null
    return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
  }
  return { clientX: e.clientX, clientY: e.clientY }
}
