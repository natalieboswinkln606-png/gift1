import type { GestureType, GestureAction, AppState } from '@/types'

/**
 * Scene-aware gesture → action mapping.
 *
 * Each scene defines which gestures produce which actions.
 * Unmapped gestures return null (no action).
 */

type SceneType = Exclude<AppState, 'PRELOAD'>

const GESTURE_MAP: Record<SceneType, Partial<Record<GestureType, GestureAction>>> = {
  GIFTBOX: {
    PINCH: 'OPEN_BOX',
  },
  WELCOME: {
    POINT: 'HOVER_BUTTON',
    PINCH: 'CLICK_BUTTON',
  },
  SELECTOR: {
    POINT: 'HOVER_PANEL',
    PINCH: 'SELECT_PANEL',
  },
  CHRISTMAS: {
    FIST: 'TREE_MODE',
    OPEN: 'SCATTER_MODE',
    PINCH: 'HEART_MODE',
    THREE_FINGER: 'PAINT_MODE',
    POINT: 'NEXT_PHOTO',
  },
  STARRY: {
    FIST: 'COMPACT_MODE',
    OPEN: 'SCATTER_MODE',
    PINCH: 'HEART_MODE',
  },
}

/** Paint mode overrides for ChristmasScene */
const CHRISTMAS_PAINT_OVERRIDES: Partial<Record<GestureType, GestureAction>> = {
  FIST: 'TREE_MODE',       // exit paint → tree
  OPEN: 'SCATTER_MODE',    // exit paint → scatter
  // PINCH in paint mode is handled directly by the scene (drawing)
}

export interface GestureMapContext {
  isPaintMode?: boolean
}

/**
 * Map a gesture to a scene-specific action.
 * Returns 'NONE' if the gesture has no mapping in the current scene.
 * Never returns null.
 */
export function mapGesture(
  gesture: GestureType,
  scene: SceneType,
  context?: GestureMapContext
): GestureAction {
  if (gesture === 'NONE') return 'NONE'

  // Christmas paint mode has special overrides
  if (scene === 'CHRISTMAS' && context?.isPaintMode) {
    return CHRISTMAS_PAINT_OVERRIDES[gesture] ?? 'NONE'
  }

  return GESTURE_MAP[scene]?.[gesture] ?? 'NONE'
}

/**
 * Check if a gesture has any mapping in the given scene.
 */
export function isGestureMapped(gesture: GestureType, scene: SceneType): boolean {
  if (gesture === 'NONE') return false
  return gesture in (GESTURE_MAP[scene] ?? {})
}
