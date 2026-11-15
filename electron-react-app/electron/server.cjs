// @ts-check
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')

/** @param {import('electron').App} app @param {import('electron').Dialog} dialog */
async function startServer(app, dialog) {
  const dataDirectory = app.getPath('userData')
  await fs.mkdir(dataDirectory, { recursive: true, mode: 0o700 })
  const configPath = path.join(dataDirectory, 'server.json')
  try {
    await fs.access(configPath)
  } catch {
    const selection = await dialog.showOpenDialog({
      title: 'Select your administrator-provided server configuration',
      properties: ['openFile'],
      filters: [{ name: 'Server configuration', extensions: ['json'] }],
    })
    if (selection.canceled) throw new Error('A server configuration is required. Reopen Pangaea and select your server.json file.')
    const contents = await fs.readFile(selection.filePaths[0], 'utf8')
    // Validate before saving; never echo configuration contents in an error dialog.
    let config
    try { config = JSON.parse(contents) } catch { throw new Error('The server configuration must be valid JSON.') }
    if (!config?.ConnectionStrings?.Postgres || typeof config?.Jwt?.Key !== 'string' || Buffer.byteLength(config.Jwt.Key) < 32) {
      throw new Error('The server configuration needs ConnectionStrings.Postgres and a Jwt.Key of at least 32 bytes.')
    }
    await fs.writeFile(configPath, contents, { mode: 0o600, flag: 'wx' })
  }
  await fs.chmod(configPath, 0o600)

  const portPath = path.join(dataDirectory, 'server-port')
  let port = 0
  try {
    const saved = Number(await fs.readFile(portPath, 'utf8'))
    if (Number.isInteger(saved) && saved >= 1024 && saved <= 65535) port = saved
  } catch { /* First launch: let the OS allocate a port. */ }
  const temporaryDirectory = await fs.mkdtemp(path.join(dataDirectory, 'server-start-'))
  const readyFile = path.join(temporaryDirectory, 'ready')
  const serverDirectory = path.join(process.resourcesPath, 'server')
  const child = spawn(path.join(serverDirectory, 'rest-server'), [], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Production',
      DOTNET_ENVIRONMENT: 'Production',
      ASPNETCORE_WEBROOT: path.join(process.resourcesPath, 'ui'),
      PANGAEA_DESKTOP_CONFIG: configPath,
      PANGAEA_DESKTOP_READY_FILE: readyFile,
      PANGAEA_DESKTOP_PORT: String(port),
    },
    // Do not copy backend output (which can contain database details) into UI logs.
    stdio: ['pipe', 'ignore', 'ignore'],
  })
  let failed = false
  child.on('error', () => { failed = true })
  try {
    for (let attempt = 0; attempt < 600; attempt++) {
      if (failed || child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`The bundled server could not start. Check the database connection, applied migrations, and ${configPath}. If the saved port is occupied, close the other application and try again.`)
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
    child.kill('SIGTERM')
    throw error
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true })
  }
}

module.exports = { startServer }
