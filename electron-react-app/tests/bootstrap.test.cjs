const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { parseBootstrap, serializeBootstrap, loadBundledCredentials, resolveCredentials } = require('../electron/bootstrap.cjs')

test('bundled env retains only database settings and preserves quoted passwords', () => {
  const input = [
    'ConnectionStrings__Postgres=\'Host=db.test;Password="p#ss word";SSL Mode=VerifyFull\'',
    'ConnectionStrings__PynSource="Host=source.test;Password=read-only"',
    'PynSync__ViewSchema="analytics"',
    'Jwt__Key="shared-key-must-not-ship"',
    'SeedAdmin__Password="admin-password-must-not-ship"',
    'SeedDemoData=true',
  ].join('\n')
  const serialized = serializeBootstrap(input)
  assert.deepEqual(parseBootstrap(serialized), {
    ConnectionStrings__Postgres: 'Host=db.test;Password="p#ss word";SSL Mode=VerifyFull',
    ConnectionStrings__PynSource: 'Host=source.test;Password=read-only',
    PynSync__ViewSchema: 'analytics',
  })
  assert.equal(serialized.includes('shared-key-must-not-ship'), false)
  assert.equal(serialized.includes('admin-password-must-not-ship'), false)
  assert.equal(serialized.includes('SeedDemoData'), false)
})

test('missing primary database is rejected without revealing source secrets', () => {
  assert.throws(() => serializeBootstrap('Jwt__Key=super-secret'), /^Error: The bundled environment needs a PostgreSQL connection string\.$/)
})

test('fresh installations use bundled credentials with independent persistent signing keys and no dialogs or Keychain', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pangaea-bootstrap-test-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const resources = path.join(directory, 'resources')
  await fs.mkdir(path.join(resources, 'bootstrap'), { recursive: true })
  const firstData = path.join(directory, 'first')
  assert.equal(await loadBundledCredentials(resources, firstData), null)
  await fs.writeFile(path.join(resources, 'bootstrap', '.env'), 'ConnectionStrings__Postgres="Host=db.test;Password=fake"\nJwt__Key=do-not-use')
  const first = await resolveCredentials({ load: async () => null }, {}, () => loadBundledCredentials(resources, firstData))
  assert.equal(first.ConnectionStrings__Postgres, 'Host=db.test;Password=fake')
  assert.ok(Buffer.byteLength(first.Jwt__Key) >= 32)
  assert.notEqual(first.Jwt__Key, 'do-not-use')
  assert.deepEqual(await fs.readdir(firstData), ['server-signing-key'])
  assert.equal((await fs.stat(path.join(firstData, 'server-signing-key'))).mode & 0o777, 0o600)
  const again = await loadBundledCredentials(resources, firstData)
  const second = await loadBundledCredentials(resources, path.join(directory, 'second'))
  assert.equal(again.Jwt__Key, first.Jwt__Key)
  assert.notEqual(second.Jwt__Key, first.Jwt__Key)
})

test('launch overrides and saved dialog settings each take priority over bundled defaults', async () => {
  const saved = { ConnectionStrings__Postgres: 'saved', Jwt__Key: 'saved-key' }
  const launch = { ConnectionStrings__Postgres: 'launch', Jwt__Key: 'launch-key' }
  const unused = async () => { throw Error('Must not load lower-priority credentials') }
  assert.equal(await resolveCredentials({ load: unused }, launch, unused), launch)
  assert.equal(await resolveCredentials({ load: async () => saved }, {}, unused), saved)
  assert.equal(await resolveCredentials({ load: async () => null }, {}, async () => null), null)
})

test('locked user overrides do not silently fall back to a different bundled database', async () => {
  await assert.rejects(resolveCredentials({ load: async () => { throw Error('locked') } }, {}, async () => ({ ConnectionStrings__Postgres: 'other-db' })), /locked/)
})
