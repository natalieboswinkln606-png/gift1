import gsap from 'gsap'
import type { AppState } from '@/types'
import { useAppStore } from '@/stores/useAppStore'

export class TransitionController {
  private currentTimeline: gsap.core.Timeline | null = null
  private isTransitioning = false

  async transition(from: AppState, to: AppState): Promise<void> {
    if (this.isTransitioning) return
    this.isTransitioning = true

    if (this.currentTimeline) {
      this.currentTimeline.kill()
    }

    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.isTransitioning = false
          this.currentTimeline = null
          resolve()
        },
      })
      this.currentTimeline = tl

      // State update happens after a brief delay for visual transition
      tl.call(
        () => {
          useAppStore.getState().setAppState(to)
        },
        undefined,
        0.3
      )
    })
  }

  // Utility: fade out DOM elements
  static fadeOut(elements: HTMLElement[], duration = 0.5): gsap.core.Timeline {
    const tl = gsap.timeline()
    tl.to(elements, {
      opacity: 0,
      duration,
      ease: 'power2.in',
    })
    return tl
  }

  // Utility: fade in DOM elements
  static fadeIn(elements: HTMLElement[], duration = 0.5): gsap.core.Timeline {
    const tl = gsap.timeline()
    tl.to(elements, {
      opacity: 1,
      duration,
      ease: 'power2.out',
    })
    return tl
  }

  // Utility: elastic entrance for multiple elements
  static elasticEnter(elements: HTMLElement[], stagger = 0.05): gsap.core.Timeline {
    const tl = gsap.timeline()
    tl.fromTo(
      elements,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.8,
        ease: 'elastic.out(1, 0.5)',
        stagger,
      }
    )
    return tl
  }

  isActive(): boolean {
    return this.isTransitioning
  }

  kill(): void {
    if (this.currentTimeline) {
      this.currentTimeline.kill()
      this.currentTimeline = null
    }
    this.isTransitioning = false
  }
}
