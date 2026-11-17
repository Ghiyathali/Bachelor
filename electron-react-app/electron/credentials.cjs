// @ts-check
// Stores the database settings on this computer, encrypted by the operating system's secure
// storage (Windows: DPAPI, macOS: Keychain) through Electron's safeStorage. The app window
// never sees them.
const fs = require('node:fs/promises')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

/** @param {string} directory @param {import('electron').SafeStorage} storage */
function credentialStore(directory, storage) {
  const file = path.join(directory, 'server-credentials.encrypted')
  // Returns the saved settings, or null when nothing has been saved yet (first launch).
  async function load() {
    let encrypted
    try { encrypted = await fs.readFile(file) } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
      throw new Error('Could not read saved database settings.')
    }
    try {
      const decrypted = await storage.decryptStringAsync(encrypted)
      return JSON.parse(decrypted.result)
    } catch {
      throw new Error('Could not unlock database settings. Open Database connection to enter them again.')
    }
  }
  // Checks and encrypts the settings, writes them to a temporary file and then renames it, so a
  // crash halfway can never leave a broken settings file. The JWT signing key is created here
  // and kept when the same database is saved again.
  /** @param {{ postgres: string, pynSource?: string }} input */
  async function save(input) {
    if (typeof input?.postgres !== 'string' || !input.postgres.trim() || input.postgres.length > 16384 ||
        (input.pynSource !== undefined && (typeof input.pynSource !== 'string' || input.pynSource.length > 16384))) {
      throw new Error('Enter a valid PostgreSQL connection string.')
    }
    if (!(await storage.isAsyncEncryptionAvailable()) ||
        (process.platform === 'linux' && ['basic_text', 'unknown'].includes(storage.getSelectedStorageBackend()))) {
      throw new Error('Secure storage is unavailable. Unlock your Keychain and try again. Credentials have not been saved.')
    }
    let previous
    try { previous = await load() } catch { /* Allow replacing an unreadable entry. */ }
    const settings = {
      ConnectionStrings__Postgres: input.postgres.trim(),
      ConnectionStrings__PynSource: input.pynSource?.trim() ?? '',
      // Never expose the signing key to either renderer. A database switch logs out old sessions.
      Jwt__Key: previous?.ConnectionStrings__Postgres === input.postgres.trim()
        ? previous.Jwt__Key : randomBytes(48).toString('base64'),
    }
    const encrypted = await storage.encryptStringAsync(JSON.stringify(settings))
    await fs.mkdir(directory, { recursive: true, mode: 0o700 })
    const temporary = file + '.tmp'
    await fs.writeFile(temporary, encrypted, { mode: 0o600 })
    await fs.chmod(temporary, 0o600)
    await fs.rename(temporary, file)
  }
  return { load, save }
}
module.exports = { credentialStore }
