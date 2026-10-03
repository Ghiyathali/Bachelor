// @ts-check

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  // Asks the main process to save the current page as a PDF (QR code page).
  savePdf: () => ipcRenderer.invoke('save-pdf'),
})
