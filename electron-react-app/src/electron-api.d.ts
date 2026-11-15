// Types for what electron/preload.cjs exposes on window.electronAPI.
// It is undefined when the React app runs in a normal browser (e.g. plain `vite`).
export {}

declare global {
  interface Window {
    databaseSettings: {
      state: () => Promise<{ saved: boolean; environmentOverride: boolean }>
      save: (input: { postgres: string; pynSource?: string }) => Promise<{ saved?: boolean; error?: string }>
    }
    electronAPI?: {
      platform: string
      bundledServer: boolean
      openDatabaseSettings: () => Promise<void>
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
