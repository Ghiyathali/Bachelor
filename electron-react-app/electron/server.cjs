// @ts-check
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')

/** @param {import('electron').App} app @param {NodeJS.ProcessEnv} overrides */
async function startServer(app, overrides = {}) {
  const environment = { ...process.env, ...overrides }
  if (!environment.ConnectionStrings__Postgres?.trim() || Buffer.byteLength(environment.Jwt__Key ?? '') < 32) {
    throw new Error('Launch configuration requires both ConnectionStrings__Postgres and Jwt__Key (at least 32 bytes).')
  }
  const dataDirectory = app.getPath('userData')
  await fs.mkdir(dataDirectory, { recursive: true, mode: 0o700 })
  const portPath = path.join(dataDirectory, 'server-port')
  let port = 0
  try {
    const saved = Number(await fs.readFile(portPath, 'utf8'))
    if (Number.isInteger(saved) && saved >= 1024 && saved <= 65535) port = saved
  } catch { /* First launch: let the OS allocate a port. */ }
  const temporaryDirectory = await fs.mkdtemp(path.join(dataDirectory, 'server-start-'))
  const readyFile = path.join(temporaryDirectory, 'ready')
  const serverDirectory = path.join(process.resourcesPath, 'server')
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
    child.kill('SIGTERM')
    throw error
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true })
  }
}

module.exports = { startServer }
