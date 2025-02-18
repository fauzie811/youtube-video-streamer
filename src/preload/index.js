import { contextBridge, clipboard } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
// import { Titlebar } from 'custom-electron-titlebar'

// Custom APIs for renderer
const api = {
  clipboard,
  showAbout: () => electronAPI.ipcRenderer.invoke('show-about')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

// window.addEventListener('DOMContentLoaded', () => {
//   // Title bar implementation
//   new Titlebar()
// })
