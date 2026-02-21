import { Scene, WebGLRenderer } from 'three'
import { SubtitleScreen } from './SubtitleScreen'
import { getLunarDateString } from '@/lib/lunarCalendar'

/**
 * 爱心场景字幕条系统
 * 组合两个 SubtitleScreen 实例，分别显示公历和农历内容
 * 字幕条一：公历实时日期时间 + 用户名 + 固定祝福语
 * 字幕条二：农历实时日期时间 + 用户名 + config 祝福语
 */
export class HeartSubtitleBanner {
  private strip1: SubtitleScreen
  private strip2: SubtitleScreen

  constructor(scene: Scene, renderer: WebGLRenderer, userName: string, blessing: string) {
    // 字幕条一：公历，z 轴 +30°倾斜，启用 bloom（宽度与字体在星轨基础上放大 2/5）
    this.strip1 = new SubtitleScreen(scene, renderer, userName, '愿每一秒的流转，都闪烁星辰之光。', {
      radius: 20,
      screenHeight: 0.084,
      tiltZDeg: 30,
      yOffset: -10,
      enableBloom: true,
      fontSize: 17,
      initialVisible: false,
    })

    // 字幕条二：农历，z 轴 -30°倾斜，启用 bloom，自定义内容（宽度与字体在星轨基础上放大 2/5）
    this.strip2 = new SubtitleScreen(scene, renderer, userName, blessing, {
      radius: 20,
      screenHeight: 0.084,
      tiltZDeg: -30,
      yOffset: -10,
      enableBloom: true,
      fontSize: 17,
      initialVisible: false,
      contentFn: (name: string, bless: string) => {
        const now = new Date()
        const lunarDate = getLunarDateString(now)
        const hour = now.getHours()
        const zhiNames = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
        const zhiIndex = Math.floor(((hour + 1) % 24) / 2)
        const shichen = zhiNames[zhiIndex] + '时'
        return `  ${lunarDate} ${shichen}  |  ${name}  |  ${bless}  |  `
      },
    })
  }

  get visible(): boolean {
    return this.strip1.visible
  }

  set visible(v: boolean) {
    this.strip1.visible = v
    this.strip2.visible = v
  }

  update(time: number, dt: number): void {
    this.strip1.update(time, dt)
    this.strip2.update(time, dt)
  }

  dispose(): void {
    this.strip1.dispose()
    this.strip2.dispose()
  }
}
