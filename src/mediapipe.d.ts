// Type declarations for packages with broken exports/types mapping

declare module '@mediapipe/tasks-vision' {
  export interface NormalizedLandmark {
    x: number
    y: number
    z: number
  }

  export interface Landmark {
    x: number
    y: number
    z: number
  }

  export interface Category {
    index: number
    score: number
    categoryName: string
    displayName: string
  }

  export interface HandLandmarkerResult {
    landmarks: NormalizedLandmark[][]
    worldLandmarks: Landmark[][]
    handednesses: Category[][]
  }

  export interface HandLandmarkerOptions {
    baseOptions?: {
      modelAssetPath?: string
      modelAssetBuffer?: Uint8Array
      delegate?: 'CPU' | 'GPU'
    }
    runningMode?: 'IMAGE' | 'VIDEO'
    numHands?: number
    minHandDetectionConfidence?: number
    minHandPresenceConfidence?: number
    minTrackingConfidence?: number
  }

  export interface WasmFileset {
    wasmLoaderPath: string
    wasmBinaryPath: string
  }

  export class HandLandmarker {
    static createFromOptions(
      wasmFileset: WasmFileset,
      options: HandLandmarkerOptions
    ): Promise<HandLandmarker>
    static createFromModelPath(
      wasmFileset: WasmFileset,
      modelAssetPath: string
    ): Promise<HandLandmarker>
    detect(
      image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData | ImageBitmap
    ): HandLandmarkerResult
    detectForVideo(
      videoFrame: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData | ImageBitmap,
      timestamp: number
    ): HandLandmarkerResult
    setOptions(options: HandLandmarkerOptions): Promise<void>
    close(): void
  }

  export class FilesetResolver {
    static forVisionTasks(basePath?: string): Promise<WasmFileset>
    static forAudioTasks(basePath?: string): Promise<WasmFileset>
    static forTextTasks(basePath?: string): Promise<WasmFileset>
  }
}
