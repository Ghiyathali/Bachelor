// @ts-check

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  // Asks the main process to save the current page as a PDF (QR code page).
  savePdf: () => ipcRenderer.invoke('save-pdf'),
  // Asks the main process to save the impact report as an SVG or PDF (FR-11).
  /** @param {{ format: 'svg' | 'pdf', svg: string, fileName: string }} report */
  saveReport: (report) => ipcRenderer.invoke('save-report', report),
})
