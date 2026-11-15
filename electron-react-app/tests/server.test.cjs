const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { once } = require('node:events')
const { startServer } = require('../electron/server.cjs')

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pangaea-server-test-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const data = path.join(directory, 'user')
  const resources = path.join(directory, 'resources')
  await fs.mkdir(path.join(resources, 'server'), { recursive: true })
  await fs.mkdir(data)
  process.resourcesPath = resources
  return { data, resources, app: { getPath: () => data } }
}

test('bundled server uses runtime credentials, loopback readiness, a persistent port, and stdin ownership', async t => {
  const { data, resources, app } = await fixture(t)
  const credentials = { ConnectionStrings__Postgres: 'Host=test', Jwt__Key: 'x'.repeat(48) }
  await fs.writeFile(path.join(resources, 'server', 'rest-server'), `#!${process.execPath}
const fs = require('node:fs');
const http = require('node:http');
if (process.env.DOTNET_ENVIRONMENT !== 'Production') process.exit(2);
if (process.env.ConnectionStrings__Postgres !== 'Host=test') process.exit(3);
const server = http.createServer((req, res) => res.end('test'));
server.listen(Number(process.env.PANGAEA_DESKTOP_PORT), '127.0.0.1', () => {
  fs.writeFileSync(process.env.PANGAEA_DESKTOP_READY_FILE, 'http://127.0.0.1:' + server.address().port);
});
process.stdin.resume();
process.stdin.on('end', () => server.close());
`, { mode: 0o755 })
  const first = await startServer(app, credentials)
  t.after(() => first.child.kill())
  assert.equal(await (await fetch(first.origin)).text(), 'test')
  assert.deepEqual(await fs.readdir(data), ['server-port'])
  const exited = once(first.child, 'exit')
  first.child.stdin.end()
  await exited
  const second = await startServer(app, credentials)
  t.after(() => second.child.kill())
  assert.equal(second.origin, first.origin)
  const stopped = once(second.child, 'exit')
  second.child.stdin.end()
  await stopped
  assert.equal((await fs.readdir(data)).some(name => name.startsWith('server-start-')), false)
})

test('legacy JSON is ignored when runtime credentials are missing', async t => {
  const { app, data } = await fixture(t)
  const legacy = JSON.stringify({ ConnectionStrings: { Postgres: 'Host=legacy' }, Jwt: { Key: 'x'.repeat(48) } })
  await fs.writeFile(path.join(data, 'server.json'), legacy)
  await assert.rejects(startServer(app, { ConnectionStrings__Postgres: '', Jwt__Key: '' }), /requires both/)
  assert.deepEqual(await fs.readdir(data), ['server.json'])
  assert.equal(await fs.readFile(path.join(data, 'server.json'), 'utf8'), legacy)
})

test('failed child startup reports a configuration error and cleans readiness files', async t => {
  const { app, data } = await fixture(t)
  await assert.rejects(startServer(app, { ConnectionStrings__Postgres: 'Host=test', Jwt__Key: 'x'.repeat(48) }), /bundled server could not start/)
  assert.equal((await fs.readdir(data)).some(name => name.startsWith('server-start-')), false)
})

test('runtime credential overrides bypass file provisioning and never save credentials', async t => {
  const { app, data, resources } = await fixture(t)
  await fs.writeFile(path.join(resources, 'server', 'rest-server'), `#!${process.execPath}
const fs = require('node:fs');
if (process.env.PANGAEA_DESKTOP_MODE !== '1' ||
    process.env.ConnectionStrings__Postgres !== 'Host=test' || process.env.Jwt__Key !== 'k'.repeat(48)) process.exit(2);
fs.writeFileSync(process.env.PANGAEA_DESKTOP_READY_FILE, 'http://127.0.0.1:49152');
process.stdin.resume();
`, { mode: 0o755 })
  const running = await startServer(app, {
    ConnectionStrings__Postgres: 'Host=test', Jwt__Key: 'k'.repeat(48),
  })
  t.after(() => running.child.kill())
  assert.deepEqual(await fs.readdir(data), ['server-port'])
  const stopped = once(running.child, 'exit')
  running.child.stdin.end()
  await stopped
})

test('partial launch configuration fails before starting a child', async t => {
  const { app, data } = await fixture(t)
  await assert.rejects(startServer(app, { ConnectionStrings__Postgres: 'Host=test', Jwt__Key: '' }), /requires both/)
  assert.deepEqual(await fs.readdir(data), [])
})
