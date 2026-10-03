// @ts-check

const { app, BrowserWindow, dialog, ipcMain } = require('electron')
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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
