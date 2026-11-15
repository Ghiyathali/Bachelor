const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
process.chdir(root)
const arch = process.argv[2] || process.arch
if (process.platform !== 'darwin' || !['arm64', 'x64'].includes(arch)) {
  throw new Error('Build on macOS with: npm run dist:mac -- [arm64|x64]')
}
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: 'inherit', env })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

// Force relative API requests; no build-time remote API override in bundled mode.
run('npm', ['run', 'build'], { ...process.env, VITE_API_URL: '' })
const server = path.join(root, 'build', 'server')
fs.rmSync(server, { recursive: true, force: true })
run('dotnet', ['publish', '../rest-server/rest-server.csproj', '-c', 'Release',
  '-r', `osx-${arch}`, '--self-contained', 'true', '-o', server, '-p:UseAppHost=true'])
// Only binaries/runtime metadata and the public base configuration belong in the DMG.
// Explicit allowlist also excludes source, HTTP samples, SQL, and future secret files.
for (const entry of fs.readdirSync(server, { withFileTypes: true })) {
  if (entry.isDirectory() || !(
    entry.name === 'rest-server' || entry.name === 'appsettings.json' ||
    /\.(dll|dylib|deps\.json|runtimeconfig\.json)$/.test(entry.name)
  )) fs.rmSync(path.join(server, entry.name), { recursive: true, force: true })
}
run(process.execPath, ['node_modules/electron-builder/cli.js', '--config', 'electron-builder.cjs', '--mac', '--' + arch], {
  ...process.env,
  // Do not select a personal development certificate from the local Keychain.
  // Release builders explicitly opt in or supply CSC_LINK/CSC_NAME.
  CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY ?? 'false',
})
