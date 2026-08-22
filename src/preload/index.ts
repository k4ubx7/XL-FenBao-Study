import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  FenbaoApi,
  QueueSnapshot
} from '../shared/contracts'

const api: FenbaoApi = Object.freeze({
  getSnapshot: () => ipcRenderer.invoke('queue:getSnapshot'),
  addInput: (text: string) => ipcRenderer.invoke('queue:addInput', { text }),
  cancelTask: (taskId: string) =>
    ipcRenderer.invoke('queue:cancel', { taskId }),
  retryTask: (taskId: string) =>
    ipcRenderer.invoke('queue:retry', { taskId }),
  resumeTask: (taskId: string) =>
    ipcRenderer.invoke('queue:resume', { taskId }),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:update', patch),
  chooseDownloadRoot: () => ipcRenderer.invoke('dialog:chooseDownloadRoot'),
  openTaskFolder: (taskId: string) =>
    ipcRenderer.invoke('shell:openTaskFolder', { taskId }),
  onSnapshot: (listener: (snapshot: QueueSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: QueueSnapshot) =>
      listener(snapshot)
    ipcRenderer.on('queue:snapshot', handler)
    return () => ipcRenderer.removeListener('queue:snapshot', handler)
  }
})

contextBridge.exposeInMainWorld('fenbao', api)
