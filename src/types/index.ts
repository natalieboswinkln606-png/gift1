import * as THREE from 'three'

// User configuration from config.json
export interface UserConfig {
  name: string
  identifier: string
  christmasPhotos: string[]
  starrySilhouette: string
  starryBlessing: string
}

// User registry entry (from public/users.json)
export interface UserEntry {
  id: string
  displayName: string
  subtitle: string
  emoji: string
  gradient: string
  hoverBorder: string
  iconBg: string
  iconBgHover: string
}

// Scene modes
export type SceneMode = 'TREE' | 'SCATTER' | 'HEART'
export type AnimPhase = 'IDLE' | 'EXPLODE' | 'CONVERGE'
export type QualityLevel = 'HIGH' | 'MEDIUM' | 'LOW'

// App state machine
export type AppState = 'PRELOAD' | 'GIFTBOX' | 'WELCOME' | 'SELECTOR' | 'CHRISTMAS' | 'STARRY'

// Gesture types
export type GestureType = 'NONE' | 'FIST' | 'OPEN' | 'PINCH' | 'THREE_FINGER' | 'POINT'

// Gesture actions mapped per scene
export type GestureAction =
  | 'NONE'
  | 'OPEN_BOX'
  | 'HOVER_BUTTON' | 'CLICK_BUTTON'
  | 'HOVER_PANEL' | 'SELECT_PANEL'
  | 'TREE_MODE' | 'SCATTER_MODE' | 'HEART_MODE' | 'PAINT_MODE' | 'NEXT_PHOTO'
  | 'COMPACT_MODE'

// Camera permission state
export type CameraPermission = 'granted' | 'denied' | 'prompt' | null

// Stabilized gesture result from the pipeline
export interface StabilizedGestureResult {
  gesture: GestureType
  confidence: number
  smoothedLandmarks: Landmark[] | null
  cursorPosition: { x: number; y: number }
}

// Particle data structure
export interface ParticleData {
  id: number
  isStatic: boolean
  isCore: boolean
  freqIndex: number
  currentPos: THREE.Vector3
  velocity: THREE.Vector3
  tTree: THREE.Vector3
  tScatter: THREE.Vector3
  tExplode: THREE.Vector3
  tHeart: THREE.Vector3
  baseScatterPos: THREE.Vector3
  noiseOffset: THREE.Vector3
  color: THREE.Color
  speed: number
  offset: number
  baseScale: number
  meshIndex: number      // 0=sphere, 1=box, 2=tetra
  internalIndex: number  // index within its InstancedMesh
}

// Particle system configuration
export interface ParticleConfig {
  count: number
  trunkCount: number
  textCount: number
  bgStarCount: number
  treeHeight: number
  treeRadius: number
  galaxyRadius: number
  floorRadius: number
  colors: {
    cyan: THREE.Color
    blue: THREE.Color
    purple: THREE.Color
    gold: THREE.Color
    white: THREE.Color
  }
}

// Quality settings
export interface QualitySettings {
  particleCount: number
  bloomStrength: number
  bgStars: number
  pixelRatio: number
  updateEveryNFrames: number
  bloomEnabled: boolean
}

// Photo data
export interface PhotoData {
  frame: THREE.Mesh
  photoMesh: THREE.Mesh
  treePos: THREE.Vector3
  treeRot: THREE.Euler
  scatterRadius: number
  scatterAngle: number
  scatterY: number
  selfRotSpeed: number
}

// Audio state
export interface PlaylistItem {
  name: string
  url: string
}

// Hand landmark from MediaPipe
export interface Landmark {
  x: number
  y: number
  z: number
}

// MediaPipe hand connections (21 landmarks, pairs define skeleton lines)
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17],            // Palm
]

// Starry scene state
export type StarrySceneState = 'FIST' | 'OPEN'

// Starry particle data
export interface StarryParticleData {
  id: number
  currentPos: THREE.Vector3
  velocity: THREE.Vector3
  tFist: THREE.Vector3
  tOpen: THREE.Vector3
  tExplode: THREE.Vector3
  color: THREE.Color
  speed: number
  offset: number
  baseScale: number
  meshIndex: number
  internalIndex: number
}
