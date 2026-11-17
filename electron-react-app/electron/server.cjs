// @ts-check
// Starts the bundled REST API (rest-server, published as a self-contained program) as a child
// process of the desktop app and waits until it is ready. Everything stays on this computer:
// the API only listens on 127.0.0.1.
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')

// overrides = the database settings (saved in the app, or environment variables at launch).
// Returns the running process and the address the app window should load.
/** @param {import('electron').App} app @param {NodeJS.ProcessEnv} overrides */
async function startServer(app, overrides = {}) {
  const environment = { ...process.env, ...overrides }
  if (!environment.ConnectionStrings__Postgres?.trim() || Buffer.byteLength(environment.Jwt__Key ?? '') < 32) {
    throw new Error('Launch configuration requires both ConnectionStrings__Postgres and Jwt__Key (at least 32 bytes).')
  }
  // The same port is reused on every launch: the app window keeps data such as the login and the
  // theme per address, so a new port each time would lose them.
  const dataDirectory = app.getPath('userData')
  await fs.mkdir(dataDirectory, { recursive: true, mode: 0o700 })
  const portPath = path.join(dataDirectory, 'server-port')
  let port = 0
  try {
    const saved = Number(await fs.readFile(portPath, 'utf8'))
    if (Number.isInteger(saved) && saved >= 1024 && saved <= 65535) port = saved
  } catch { /* First launch: let the OS allocate a port. */ }
  // The API writes its address into this "ready" file once it is listening (PANGAEA_DESKTOP_READY_FILE).
  const temporaryDirectory = await fs.mkdtemp(path.join(dataDirectory, 'server-start-'))
  const readyFile = path.join(temporaryDirectory, 'ready')
  const serverDirectory = path.join(process.resourcesPath, 'server')
  // Start the API in Production mode. The settings are passed as environment variables, never as files.
  const child = spawn(path.join(serverDirectory, process.platform === 'win32' ? 'rest-server.exe' : 'rest-server'), [], {
    cwd: serverDirectory,
    env: {
      ...environment,
      ASPNETCORE_ENVIRONMENT: 'Production',
      DOTNET_ENVIRONMENT: 'Production',
      ASPNETCORE_WEBROOT: path.join(process.resourcesPath, 'ui'),
      PANGAEA_DESKTOP_MODE: '1',
      PANGAEA_DESKTOP_READY_FILE: readyFile,
      PANGAEA_DESKTOP_PORT: String(port),
    },
    // Do not copy backend output (which can contain database details) into UI logs.
    stdio: ['pipe', 'ignore', 'ignore'],
  })
  let failed = false
  child.on('error', () => { failed = true })
  try {
    // Wait up to 60 seconds (600 x 100 ms) for the ready file, and stop early if the API crashed.
    for (let attempt = 0; attempt < 600; attempt++) {
      if (failed || child.exitCode !== null || child.signalCode !== null) {
        throw new Error('The bundled server could not start. Check the saved connection settings or launch environment variables, database access, and applied migrations. If the saved port is occupied, close the other application and try again.')
      }
      try {
        const origin = (await fs.readFile(readyFile, 'utf8')).trim()
        if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
          await fs.writeFile(portPath, new URL(origin).port, { mode: 0o600 })
          return { child, origin }
        }
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
      }
      await delay(100)
    }
    throw new Error('The bundled server timed out. Check database connectivity and try again.')
  } catch (error) {
    // Starting failed: never leave a half-started API running in the background.
    child.kill('SIGTERM')
    throw error
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true })
  }
}

module.exports = { startServer }
