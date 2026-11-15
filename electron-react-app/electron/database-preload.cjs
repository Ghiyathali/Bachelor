const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('databaseSettings', {
  state: () => ipcRenderer.invoke('database-settings-state'),
  /** @param {{ postgres: string, pynSource?: string }} input */
  save: (input) => ipcRenderer.invoke('database-settings-save', input),
})
