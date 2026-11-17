// @ts-check

// Electron main process: starts the bundled API (server.cjs), opens the app window and handles
// what a web page may not do itself (saving files, the database settings window).
// In development (npm run dev) it loads the Vite dev server instead and starts no API.
const { app, BrowserWindow, dialog, ipcMain, shell, safeStorage } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { startServer } = require('./server.cjs')
const { credentialStore } = require('./credentials.cjs')
const { loadBundledCredentials, resolveCredentials } = require('./bootstrap.cjs')

const isDevelopment = !app.isPackaged
// Installed app: keep its data (saved settings, API port) in a fixed "Pangaea" folder.
if (!isDevelopment) {
  app.setName('Pangaea')
  app.setPath('userData', path.join(app.getPath('appData'), 'Pangaea'))
}
/** @type {Awaited<ReturnType<typeof startServer>> | undefined} */
let server
let quitting = false
let bootstrapping = true
/** @type {import('electron').BrowserWindow | undefined} */
let databaseWindow
// Database settings come from environment variables when they are set at launch,
// otherwise from the encrypted store (credentials.cjs).
const store = credentialStore(app.getPath('userData'), safeStorage)
const hasLaunchCredentials = () => process.env.ConnectionStrings__Postgres !== undefined || process.env.Jwt__Key !== undefined

// The "Database connection" window. It is sandboxed and can't open links or navigate away.
function openDatabaseWindow() {
  if (databaseWindow) { databaseWindow.focus(); return }
  databaseWindow = new BrowserWindow({
    width: 680, height: 650, minWidth: 560, minHeight: 600,
    title: 'Database connection', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'database-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  databaseWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  databaseWindow.webContents.on('will-navigate', event => event.preventDefault())
  databaseWindow.on('closed', () => { databaseWindow = undefined })
  void databaseWindow.loadFile(path.join(__dirname, 'database-settings.html'))
}

// Settings may only be read or saved from that window, never from the main app window.
/** @param {import('electron').IpcMainInvokeEvent} event */
function requireDatabaseWindow(event) {
  if (!databaseWindow || event.sender !== databaseWindow.webContents || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Database settings can only be changed from the connection dialog.')
  }
}
// IPC handlers = the messages a window may send to this process. The main window may only ask
// to OPEN the settings window; reading and saving happen inside that window.
ipcMain.handle('open-database-settings', event => {
  if (isDevelopment || event.senderFrame !== event.sender.mainFrame ||
      !server || new URL(event.sender.getURL()).origin !== server.origin) return
  openDatabaseWindow()
})
ipcMain.handle('database-settings-state', async event => {
  requireDatabaseWindow(event)
  let saved = false
  try { await fs.access(path.join(app.getPath('userData'), 'server-credentials.encrypted')); saved = true } catch { /* Not configured. */ }
  return { saved, environmentOverride: hasLaunchCredentials() }
})
ipcMain.handle('database-settings-save', async (event, input) => {
  requireDatabaseWindow(event)
  if (hasLaunchCredentials()) return { error: 'This launch uses environment variables. Quit and launch normally to change saved settings.' }
  try {
    await store.save(input)
  } catch {
    return { error: 'Could not save securely. Check the connection string and unlock your Keychain, then try again.' }
  }
  // Restart, so the API starts again with the new settings.
  setTimeout(() => { app.relaunch(); app.quit() }, 150)
  return { saved: true }
})

// The main app window. It may only show pages from the local API (or the Vite dev server),
// so a link can never load a foreign website inside the app.
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
  } else if (server) {
    window.loadURL(server.origin)
  }
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    const origin = isDevelopment ? 'http://localhost:5173' : server?.origin
    if (new URL(url).origin !== origin) event.preventDefault()
  })
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

const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) app.quit()
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0]
  if (window) { if (window.isMinimized()) window.restore(); window.focus() }
})

if (hasInstanceLock) app.whenReady().then(async () => {
  if (!isDevelopment) {
    let credentials
    try {
      credentials = await resolveCredentials(store, process.env,
        () => loadBundledCredentials(process.resourcesPath, app.getPath('userData')))
    } catch (error) {
      dialog.showErrorBox('Database settings unavailable', 'Could not load the database configuration. Use the connection dialog to enter replacement settings.')
      openDatabaseWindow()
      return
    }
    if (!hasLaunchCredentials() && !credentials) {
      openDatabaseWindow()
      return
    }
    try {
      server = await startServer(app, credentials ?? {})
    } catch {
      const { response } = await dialog.showMessageBox({
        type: 'error', title: 'Could not connect',
        message: 'The local server could not start.',
        detail: 'Check the database connection, firewall access, migrations, and whether the saved local port is available. You can edit the connection without signing in.',
        buttons: ['Database connection', 'Quit'], defaultId: 0, cancelId: 1,
      })
      if (response === 0) openDatabaseWindow()
      else app.quit()
      return
    }
    server.child.on('exit', () => {
      if (!quitting) {
        dialog.showErrorBox('Pangaea server stopped', 'The local server stopped unexpectedly. Reopen Pangaea to reconnect.')
        app.quit()
      }
    })
  }
  createWindow()
}).catch(error => {
  dialog.showErrorBox('Pangaea could not start', error.message)
  app.quit()
}).finally(() => { bootstrapping = false })

app.on('activate', () => {
  if (bootstrapping) return
  if (BrowserWindow.getAllWindows().length === 0) {
    if (isDevelopment || server) createWindow()
    else openDatabaseWindow()
  }
})

// On quit, stop the API cleanly first (close its input + SIGTERM), and force it after 5 seconds.
app.on('before-quit', event => {
  if (quitting) return
  quitting = true
  if (server && server.child.exitCode === null && server.child.signalCode === null) {
    const child = server.child
    event.preventDefault()
    const timeout = setTimeout(() => { child.kill('SIGKILL'); app.quit() }, 5000)
    child.once('exit', () => { clearTimeout(timeout); app.quit() })
    child.stdin.end()
    child.kill('SIGTERM')
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
