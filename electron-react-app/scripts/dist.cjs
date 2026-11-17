// Builds the installer for one platform: 1) optional database defaults, 2) the React app,
// 3) the REST API published for that platform, 4) electron-builder. Run it through
// npm run dist:win or npm run dist:mac (macOS installers can only be built on a Mac).
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const { serializeBootstrap } = require('../electron/bootstrap.cjs')

const root = path.resolve(__dirname, '..')
function build(target, arch = process.arch) {
  process.chdir(root)
  if (!['mac', 'win'].includes(target) || !['arm64', 'x64'].includes(arch) || (target === 'mac' && process.platform !== 'darwin')) {
    throw new Error('Build with npm run dist:mac or dist:win -- [arm64|x64]. macOS builds require macOS.')
  }
  function run(command, args, env = process.env) {
    const result = spawnSync(command, args, { stdio: 'inherit', env })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status || 1)
  }

  // Database defaults: unless PANGAEA_BUNDLE_ENV=false, the connection strings from rest-server/.env
  // are bundled, so the app works right after installing. Anyone with the installer can extract them,
  // so build with PANGAEA_BUNDLE_ENV=false for an installer that asks for the connection on first start.
  const bootstrap = path.join(root, 'build', 'bootstrap')
  fs.rmSync(bootstrap, { recursive: true, force: true })
  fs.mkdirSync(bootstrap, { recursive: true, mode: 0o700 })
  if (process.env.PANGAEA_BUNDLE_ENV !== 'false') {
    const source = path.resolve(root, process.env.PANGAEA_ENV_FILE || '../rest-server/.env')
    let contents
    try { contents = fs.readFileSync(source, 'utf8') } catch {
      throw new Error('Cannot read the bundle environment file. Set PANGAEA_ENV_FILE, or PANGAEA_BUNDLE_ENV=false for a dialog-only build.')
    }
    fs.writeFileSync(path.join(bootstrap, '.env'), serializeBootstrap(contents), { mode: 0o600 })
    console.log('Bundling database defaults from the environment file. This installer contains extractable database credentials.')
  }

  // Force relative API requests; no build-time remote API override in bundled mode.
  if (!process.env.npm_execpath) throw new Error('Invoke this build through npm run dist:mac or dist:win.')
  run(process.execPath, [process.env.npm_execpath, 'run', 'build'], { ...process.env, VITE_API_URL: '' })
  // Publish the API as a self-contained program for the target platform (no .NET install needed).
  const server = path.join(root, 'build', 'server')
  fs.rmSync(server, { recursive: true, force: true })
  run('dotnet', ['publish', '../rest-server/rest-server.csproj', '-c', 'Release',
    '-r', `${target === 'mac' ? 'osx' : 'win'}-${arch}`, '--self-contained', 'true', '-o', server, '-p:UseAppHost=true'])
  // The server directory contains binaries/runtime metadata and public configuration.
  // Explicit allowlist also excludes source, HTTP samples, SQL, and future secret files.
  for (const entry of fs.readdirSync(server, { withFileTypes: true })) {
    if (entry.isDirectory() || !(
      entry.name === 'rest-server' || entry.name === 'rest-server.exe' || entry.name === 'appsettings.json' ||
      /\.(dll|dylib|deps\.json|runtimeconfig\.json)$/.test(entry.name)
    )) fs.rmSync(path.join(server, entry.name), { recursive: true, force: true })
  }
  run(process.execPath, ['node_modules/electron-builder/cli.js', '--config', 'electron-builder.cjs', '--' + target, '--' + arch], {
    ...process.env,
    // Do not select a personal development certificate from the local Keychain.
    // Release builders explicitly opt in or supply CSC_LINK/CSC_NAME.
    CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY ?? 'false',
  })
}

module.exports = { build }
