// @ts-check
const fs = require('node:fs/promises')
const path = require('node:path')
const { parseEnv } = require('node:util')
const { randomBytes } = require('node:crypto')

const bundledKeys = ['ConnectionStrings__Postgres', 'ConnectionStrings__PynSource', 'PynSync__ViewSchema']

/** @param {string} contents @returns {NodeJS.ProcessEnv} */
function parseBootstrap(contents) {
  const parsed = parseEnv(contents)
  if (!parsed.ConnectionStrings__Postgres?.trim() || parsed.ConnectionStrings__Postgres.length > 16384) {
    throw new Error('The bundled environment needs a PostgreSQL connection string.')
  }
  return Object.fromEntries(bundledKeys.filter(key => parsed[key] !== undefined).map(key => [key, parsed[key]]))
}

/** Produce a minimal .env; never ship admin seed credentials or a shared JWT key.
 * @param {string} contents */
function serializeBootstrap(contents) {
  const selected = parseBootstrap(contents)
  const result = Object.entries(selected).map(([key, value]) => {
    const quote = ["'", '"', '`'].find(candidate => !value?.includes(candidate))
    if (!quote || value?.includes('\0')) throw new Error('A bundled connection value cannot be represented in the environment file.')
    return `${key}=${quote}${value}${quote}`
  }).join('\n') + '\n'
  // Fail rather than silently corrupt passwords containing special characters.
  if (JSON.stringify(parseBootstrap(result)) !== JSON.stringify(selected)) {
    throw new Error('The bundled environment could not be serialized safely.')
  }
  return result
}

/** @param {string} resourcesDirectory @param {string} dataDirectory */
async function loadBundledCredentials(resourcesDirectory, dataDirectory) {
  let contents
  try { contents = await fs.readFile(path.join(resourcesDirectory, 'bootstrap', '.env'), 'utf8') } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw new Error('Could not read the bundled database configuration.')
  }
  const environment = parseBootstrap(contents)
  // Defaults work without Keychain access. Only user-edited overrides need safeStorage.
  // Keep signing keys installation-specific, independent of any key in the source .env.
  await fs.mkdir(dataDirectory, { recursive: true, mode: 0o700 })
  const keyFile = path.join(dataDirectory, 'server-signing-key')
  try {
    await fs.writeFile(keyFile, randomBytes(48).toString('base64'), { mode: 0o600, flag: 'wx' })
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
  }
  const key = await fs.readFile(keyFile, 'utf8')
  if (Buffer.byteLength(key) < 32) throw new Error('The local server signing key is invalid. Open connection settings to configure a replacement.')
  return { ...environment, Jwt__Key: key }
}

/** @param {{ load: () => Promise<NodeJS.ProcessEnv | null> }} store
 * @param {NodeJS.ProcessEnv} launch
 * @param {() => Promise<NodeJS.ProcessEnv | null>} bundled */
async function resolveCredentials(store, launch, bundled) {
  if (launch.ConnectionStrings__Postgres !== undefined || launch.Jwt__Key !== undefined) return launch
  return await store.load() ?? await bundled()
}

module.exports = { parseBootstrap, serializeBootstrap, loadBundledCredentials, resolveCredentials }
