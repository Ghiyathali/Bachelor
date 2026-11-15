const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { credentialStore } = require('../electron/credentials.cjs')

// Exercise the file/encryption boundary without touching the developer's Keychain.
function storage() {
  const key = crypto.randomBytes(32)
  return {
    isAsyncEncryptionAvailable: async () => true,
    getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptStringAsync: async text => {
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted])
    },
    decryptStringAsync: async bytes => {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12), { authTagLength: 16 })
      decipher.setAuthTag(bytes.subarray(12, 28))
      return { result: Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8') }
    },
  }
}
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pangaea-credentials-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return directory
}

test('credentials persist encrypted with private permissions and a stable per-database signing key', async t => {
  const directory = await fixture(t)
  const store = credentialStore(directory, storage())
  assert.equal(await store.load(), null)
  const postgres = 'Host=azure.test;Password=private-database-password'
  await store.save({ postgres, pynSource: 'Host=pyn.test;Password=private-pyn-password' })
  const file = path.join(directory, 'server-credentials.encrypted')
  const bytes = await fs.readFile(file)
  assert.equal(bytes.includes(Buffer.from('private-database-password')), false)
  assert.equal(bytes.includes(Buffer.from('private-pyn-password')), false)
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600)
  const first = await store.load()
  assert.equal(first.ConnectionStrings__Postgres, postgres)
  assert.ok(Buffer.byteLength(first.Jwt__Key) >= 32)
  await store.save({ postgres })
  const second = await store.load()
  assert.equal(second.Jwt__Key, first.Jwt__Key)
  assert.equal(second.ConnectionStrings__PynSource, '')
  await store.save({ postgres: 'Host=other.test;Password=replacement' })
  assert.notEqual((await store.load()).Jwt__Key, first.Jwt__Key)
})

test('unavailable encryption never saves plaintext or overwrites existing credentials', async t => {
  const directory = await fixture(t)
  const backend = storage()
  const store = credentialStore(directory, backend)
  await store.save({ postgres: 'Host=existing' })
  const file = path.join(directory, 'server-credentials.encrypted')
  const original = await fs.readFile(file)
  backend.isAsyncEncryptionAvailable = async () => false
  await assert.rejects(store.save({ postgres: 'Host=replacement' }), /Secure storage is unavailable/)
  assert.deepEqual(await fs.readFile(file), original)
  assert.deepEqual(await fs.readdir(directory), ['server-credentials.encrypted'])
})

test('corrupt or locked credentials can be replaced without echoing their contents', async t => {
  const directory = await fixture(t)
  const store = credentialStore(directory, storage())
  await fs.writeFile(path.join(directory, 'server-credentials.encrypted'), 'corrupt-secret-value')
  await assert.rejects(store.load(), /^Error: Could not unlock database settings\./)
  await store.save({ postgres: 'Host=repaired' })
  assert.equal((await store.load()).ConnectionStrings__Postgres, 'Host=repaired')
})

test('invalid input creates no credential file', async t => {
  const directory = await fixture(t)
  const store = credentialStore(directory, storage())
  await assert.rejects(store.save({ postgres: '' }), /valid PostgreSQL connection string/)
  await assert.rejects(store.save({ postgres: 'x'.repeat(16385) }), /valid PostgreSQL connection string/)
  assert.deepEqual(await fs.readdir(directory), [])
})
