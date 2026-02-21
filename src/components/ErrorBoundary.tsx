'use client'

import React, { ReactNode } from 'react'
import { useAppStore } from '@/stores/useAppStore'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  resetKey: number
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, resetKey: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleRetry = () => {
    useAppStore.getState().resetState()
    this.setState((prev) => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-black flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">✨</div>
              <h1 className="text-2xl font-serif text-white mb-2">
                星河出现了异常
              </h1>
              <p className="text-white/60 text-sm mb-4">
                {this.state.error?.message || '未知错误'}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded transition-colors duration-200"
              style={{ fontFamily: 'var(--font-noto-serif)' }}
            >
              重试
            </button>
          </div>
        </div>
      )
    }

    return <div key={this.state.resetKey}>{this.props.children}</div>
  }
}
