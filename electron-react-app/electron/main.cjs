// @ts-check

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const isDevelopment = !app.isPackaged

function createWindow() {
  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDevelopment) {
    window.loadURL('http://localhost:5173')
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// "Save as PDF" for the QR code page (FR-02): ask where to save, then let Chromium
// render the current page as an A4 PDF. The print CSS hides the buttons and menu.
ipcMain.handle('save-pdf', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  const options = {
    defaultPath: 'feedback-qr-code.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  }
  const { canceled, filePath } = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return { saved: false }

  const pdf = await event.sender.printToPDF({ pageSize: 'A4', printBackground: false })
  await fs.writeFile(filePath, pdf)
  return { saved: true, filePath }
})

// Turns the report's SVG into a one-page A4 PDF: an invisible window shows only the SVG and
// Chromium prints it. JavaScript is off there, because that window only has to display a picture.
/** @param {string} svg */
async function svgToPdf(svg) {
  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: { javascript: false, sandbox: true },
  })
  try {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 0 }
      html, body { margin: 0 }
      svg { display: block; width: 210mm; height: 296mm }
    </style></head><body>${svg}</body></html>`
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await pdfWindow.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    pdfWindow.destroy()
  }
}

// #80: "Show in folder" in the toast after saving. Only files this app saved itself can be
// shown, so the page cannot ask Explorer to open any path it likes.
/** @type {Set<string>} */
const savedReports = new Set()

// FR-11 / #78: ask where to save the impact report, then write it as an SVG, PDF or CSV.
// For a PDF, content is the report's SVG, which is turned into a PDF here.
ipcMain.handle('save-report', async (event, { format, content, fileName }) => {
  if (!['svg', 'pdf', 'csv'].includes(format) || typeof content !== 'string') {
    throw new Error('Invalid report')
  }
  const window = BrowserWindow.fromWebContents(event.sender)
  const options = {
    defaultPath: fileName,
    filters: [{ name: format.toUpperCase(), extensions: [format] }],
  }
  const { canceled, filePath } = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return { saved: false }

  await fs.writeFile(filePath, format === 'pdf' ? await svgToPdf(content) : content)
  savedReports.add(filePath)
  return { saved: true, filePath }
})

// #80: "Show in folder" in the toast after saving (only for files saved above).
ipcMain.handle('show-in-folder', (_event, filePath) => {
  if (typeof filePath === 'string' && savedReports.has(filePath)) shell.showItemInFolder(filePath)
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
