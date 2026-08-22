import type { FenbaoApi } from '../../shared/contracts'

declare global {
  interface Window {
    fenbao: FenbaoApi
  }
}

export {}
