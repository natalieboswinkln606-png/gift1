import { useAudioStore } from '@/stores/useAudioStore'

export class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private dataArray = new Uint8Array(128)
  private gainNode: GainNode | null = null
  private audioElement: HTMLAudioElement
  private fileSource: MediaElementAudioSourceNode | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private micStream: MediaStream | null = null
  private mode: 'NONE' | 'FILE' | 'MIC' = 'NONE'
  private playlist: Array<{ name: string; url: string }> = []
  private currentIndex = 0
  private kickCooldownFrames = 0  // 帧计数冷却替代 setTimeout
  private blobUrls: string[] = []
  private disposed = false
  private micInitializing = false
  private muteUnsub: (() => void) | null = null  // useAudioStore 订阅取消函数

  bassEnergy = 0
  volume = 0
  isKick = false
  private handleEnded = () => { this.next() }

  constructor() {
    this.audioElement = new Audio()
    this.audioElement.preload = 'none'
    this.audioElement.crossOrigin = 'anonymous'
    this.audioElement.addEventListener('ended', this.handleEnded)

    // 订阅 audioMuted 状态变化，同步到 HTMLAudioElement
    this.muteUnsub = useAudioStore.subscribe(
      (state) => {
        this.audioElement.muted = state.audioMuted
      }
    )
    // 初始同步
    this.audioElement.muted = useAudioStore.getState().audioMuted
  }

  private async ensureContext(): Promise<void> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AudioCtx()
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.85
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)

      this.gainNode = this.ctx.createGain()
      this.gainNode.gain.value = useAudioStore.getState().volume

      this.fileSource = this.ctx.createMediaElementSource(this.audioElement)
      this.fileSource.connect(this.analyser)
      this.analyser.connect(this.gainNode)
      this.gainNode.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  setPlaylist(items: Array<{ name: string; url: string }>): void {
    this.playlist = items
    this.currentIndex = 0
    useAudioStore.getState().setPlaylist(items)
  }

  addToPlaylist(name: string, url: string): void {
    this.playlist.push({ name, url })
    useAudioStore.getState().addToPlaylist([{ name, url }])
  }

  async playSong(index: number): Promise<void> {
    if (index < 0 || index >= this.playlist.length) return
    await this.ensureContext()

    this.currentIndex = index
    const song = this.playlist[index]
    this.audioElement.src = song.url
    this.mode = 'FILE'

    try {
      await this.audioElement.play()
      // 批量更新：1 次 set 替代 3 次，避免 3 次重渲染
      useAudioStore.getState().setPlayingState(true, song.name, index)
    } catch (err) {
      console.warn('Audio play failed:', err)
    }
  }

  async togglePlay(): Promise<void> {
    await this.ensureContext()

    if (this.audioElement.paused) {
      if (!this.audioElement.src && this.playlist.length > 0) {
        await this.playSong(0)
      } else {
        try {
          await this.audioElement.play()
          useAudioStore.getState().setPlaying(true)
        } catch (err) {
          console.warn('Audio play failed:', err)
        }
      }
    } else {
      this.audioElement.pause()
      useAudioStore.getState().setPlaying(false)
    }
  }

  async next(): Promise<void> {
    if (this.playlist.length === 0) return
    const nextIndex = (this.currentIndex + 1) % this.playlist.length
    await this.playSong(nextIndex)
  }

  async prev(): Promise<void> {
    if (this.playlist.length === 0) return
    const prevIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length
    await this.playSong(prevIndex)
  }

  seek(percent: number): void {
    if (this.audioElement.duration) {
      this.audioElement.currentTime = percent * this.audioElement.duration
    }
  }

  setVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val))
    if (this.gainNode) {
      this.gainNode.gain.value = clamped
    }
    useAudioStore.getState().setVolume(clamped)
  }

  setMuted(muted: boolean): void {
    this.audioElement.muted = muted
  }

  update(): void {
    if (this.disposed || !this.analyser) return

    this.analyser.getByteFrequencyData(this.dataArray)

    const len = this.dataArray.length
    let sum = 0
    let bass = 0
    for (let i = 0; i < len; i++) {
      sum += this.dataArray[i]
      if (i < 10) bass += this.dataArray[i]
    }

    this.volume = sum / len
    this.bassEnergy = bass / 10

    // Kick 检测：帧计数冷却替代 setTimeout（消除定时器 GC 压力）
    if (this.kickCooldownFrames > 0) {
      this.kickCooldownFrames--
      if (this.kickCooldownFrames === 0) this.isKick = false
    }
    if (this.bassEnergy > 150 && !this.isKick) {
      this.isKick = true
      this.kickCooldownFrames = 6  // ~100ms at 60fps
    }
  }

  getFreq(index: number): number {
    const bin = Math.floor((index / 200) * 64)
    return this.dataArray[bin % 128] || 0
  }

  async toggleMic(): Promise<void> {
    await this.ensureContext()

    if (this.micInitializing) return

    if (this.mode === 'MIC') {
      this.micSource?.disconnect()
      this.micSource = null
      this.micStream?.getTracks().forEach((t) => t.stop())
      this.micStream = null
      this.mode = this.audioElement.src ? 'FILE' : 'NONE'
    } else {
      if (this.mode === 'FILE') {
        this.audioElement.pause()
        useAudioStore.getState().setPlaying(false)
      }

      try {
        this.micInitializing = true
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        this.micSource = this.ctx!.createMediaStreamSource(this.micStream)
        // Connect ONLY to analyser, NOT to gain (prevent feedback)
        this.micSource.connect(this.analyser!)
        this.mode = 'MIC'
      } catch (err) {
        console.error('Microphone access denied:', err)
      } finally {
        this.micInitializing = false
      }
    }
  }

  async resumeContext(): Promise<void> {
    await this.ensureContext()
  }

  async loadFiles(files: FileList | File[]): Promise<void> {
    await this.ensureContext()
    this.blobUrls.forEach((url) => URL.revokeObjectURL(url))
    this.blobUrls = []
    const newFiles = Array.from(files).map((f) => {
      const url = URL.createObjectURL(f)
      this.blobUrls.push(url)
      return { name: f.name, url }
    })
    if (newFiles.length > 0) {
      const wasEmpty = this.playlist.length === 0
      this.playlist.push(...newFiles)
      useAudioStore.getState().addToPlaylist(newFiles)
      if (wasEmpty) await this.playSong(0)
    }
  }

  stop(): void {
    this.audioElement.pause()
    this.audioElement.currentTime = 0
    useAudioStore.getState().setPlaying(false)
  }

  getCurrentTime(): number {
    return this.audioElement.currentTime
  }

  getDuration(): number {
    return this.audioElement.duration || 0
  }

  dispose(): void {
    this.disposed = true
    this.muteUnsub?.()
    this.muteUnsub = null
    this.stop()
    this.audioElement.src = ''
    this.audioElement.load()
    this.audioElement.removeEventListener('ended', this.handleEnded)
    this.kickCooldownFrames = 0
    this.micSource?.disconnect()
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.fileSource?.disconnect()
    this.analyser?.disconnect()
    this.gainNode?.disconnect()
    this.blobUrls.forEach((url) => URL.revokeObjectURL(url))
    this.blobUrls = []
    this.ctx?.close()
    this.ctx = null
  }
}
