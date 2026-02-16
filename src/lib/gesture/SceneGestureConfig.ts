import type { AppState } from '@/types'

/**
 * Scene-specific gesture tuning parameters.
 *
 * Different scenes need different sensitivity:
 * - Paint mode needs pixel-level precision (responsive cursor, tight pinch)
 * - StarryScene is forgiving (smooth cursor, loose thresholds)
 */

export interface SceneGestureConfig {
  /** Spring stiffness multiplier for cursor smoothing (0.5 = smoother, 2.0 = snappier) */
  cursorStiffnessMultiplier: number
  /** Minimum confidence to accept a gesture (0.0 - 1.0) */
  confidenceThreshold: number
  /** Cooldown between gesture switches (ms) */
  cooldownMs: number
  /** PINCH distance threshold multiplier (lower = tighter) */
  pinchSensitivity: number
}

type ConfigurableScene = Exclude<AppState, 'PRELOAD'>

const DEFAULT_CONFIG: SceneGestureConfig = {
  cursorStiffnessMultiplier: 1.0,
  confidenceThreshold: 0.6,
  cooldownMs: 150,
  pinchSensitivity: 1.0,
}

const SCENE_CONFIGS: Partial<Record<ConfigurableScene, Partial<SceneGestureConfig>>> = {
  GIFTBOX: {
    // Simple scene — default is fine
  },
  WELCOME: {
    // Hover detection needs responsive cursor
    cursorStiffnessMultiplier: 1.2,
    cooldownMs: 100,
  },
  SELECTOR: {
    // Panel selection — slightly forgiving
    cursorStiffnessMultiplier: 0.9,
    cooldownMs: 200,
  },
  CHRISTMAS: {
    // Complex scene — balanced defaults
    confidenceThreshold: 0.55,
    cooldownMs: 120,
  },
  STARRY: {
    // Forgiving — smooth and relaxed
    cursorStiffnessMultiplier: 0.7,
    confidenceThreshold: 0.5,
    cooldownMs: 200,
    pinchSensitivity: 1.15,
  },
}

/**
 * Paint mode override — pixel-level precision needed.
 * Applied on top of CHRISTMAS config when paint mode is active.
 */
export const PAINT_MODE_CONFIG: Partial<SceneGestureConfig> = {
  cursorStiffnessMultiplier: 1.6,
  confidenceThreshold: 0.7,
  cooldownMs: 50,
  pinchSensitivity: 0.85,
}

/**
 * Get gesture config for a scene, merged with defaults.
 */
export function getSceneGestureConfig(scene: ConfigurableScene): SceneGestureConfig {
  return {
    ...DEFAULT_CONFIG,
    ...SCENE_CONFIGS[scene],
  }
}

/**
 * Get gesture config for paint mode (CHRISTMAS + paint overrides).
 */
export function getPaintModeConfig(): SceneGestureConfig {
  return {
    ...DEFAULT_CONFIG,
    ...SCENE_CONFIGS.CHRISTMAS,
    ...PAINT_MODE_CONFIG,
  }
}
