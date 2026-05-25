import { ElectronAPI } from '@electron-toolkit/preload'
import type { PitApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    pit: PitApi
  }
}
