// Types for what electron/preload.cjs exposes on window.electronAPI.
// It is undefined when the React app runs in a normal browser (e.g. plain `vite`).
export {}

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      savePdf: () => Promise<{ saved: boolean; filePath?: string }>
      saveReport: (report: {
        format: 'svg' | 'pdf' | 'csv'
        content: string // the SVG (also for a PDF) or the CSV text
        fileName: string
      }) => Promise<{ saved: boolean; filePath?: string }>
      showInFolder: (filePath: string) => Promise<void>
    }
  }
}
