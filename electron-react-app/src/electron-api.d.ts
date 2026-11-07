// Types for what electron/preload.cjs exposes on window.electronAPI.
// It is undefined when the React app runs in a normal browser (e.g. plain `vite`).
export {}

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      savePdf: () => Promise<{ saved: boolean; filePath?: string }>
      saveReport: (report: {
        format: 'svg' | 'pdf'
        svg: string
        fileName: string
      }) => Promise<{ saved: boolean; filePath?: string }>
    }
  }
}
