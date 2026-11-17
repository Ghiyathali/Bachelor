// Bridge for the "Database connection" window only: it exposes exactly two actions (read the
// status, save new settings) and nothing else from Node.js or Electron.
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('databaseSettings', {
  state: () => ipcRenderer.invoke('database-settings-state'),
  /** @param {{ postgres: string, pynSource?: string }} input */
  save: (input) => ipcRenderer.invoke('database-settings-save', input),
})
