import type { HarionApi } from './index'

declare global {
  interface Window {
    harion: HarionApi
  }
}

export {}
