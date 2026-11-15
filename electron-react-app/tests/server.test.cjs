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

test('bundled server uses private configuration, loopback readiness, a persistent port, and stdin ownership', async t => {
  const { data, resources, app } = await fixture(t)
  const source = path.join(data, 'provisioned.json')
  const config = { ConnectionStrings: { Postgres: 'test-only' }, Jwt: { Key: 'x'.repeat(48) } }
  await fs.writeFile(source, JSON.stringify(config))
  await fs.writeFile(path.join(resources, 'server', 'rest-server'), `#!${process.execPath}
const fs = require('node:fs');
const http = require('node:http');
if (process.env.DOTNET_ENVIRONMENT !== 'Production') process.exit(2);
if (!fs.existsSync(process.env.PANGAEA_DESKTOP_CONFIG)) process.exit(3);
const server = http.createServer((req, res) => res.end('test'));
server.listen(Number(process.env.PANGAEA_DESKTOP_PORT), '127.0.0.1', () => {
  fs.writeFileSync(process.env.PANGAEA_DESKTOP_READY_FILE, 'http://127.0.0.1:' + server.address().port);
});
process.stdin.resume();
process.stdin.on('end', () => server.close());
`, { mode: 0o755 })
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [source] }) }
  const first = await startServer(app, dialog)
  t.after(() => first.child.kill())
  assert.equal(await (await fetch(first.origin)).text(), 'test')
  assert.equal((await fs.stat(path.join(data, 'server.json'))).mode & 0o777, 0o600)
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(data, 'server.json'), 'utf8')), config)
  const exited = once(first.child, 'exit')
  first.child.stdin.end()
  await exited
  const second = await startServer(app, { showOpenDialog: () => { throw new Error('Must reuse provisioned configuration') } })
  t.after(() => second.child.kill())
  assert.equal(second.origin, first.origin)
  const stopped = once(second.child, 'exit')
  second.child.stdin.end()
  await stopped
  assert.equal((await fs.readdir(data)).some(name => name.startsWith('server-start-')), false)
})

test('cancelled provisioning starts no backend', async t => {
  const { app } = await fixture(t)
  await assert.rejects(startServer(app, { showOpenDialog: async () => ({ canceled: true }) }), /configuration is required/)
})

test('malformed provisioning is rejected without displaying secrets or saving a config', async t => {
  const { app, data } = await fixture(t)
  const source = path.join(data, 'invalid.json')
  await fs.writeFile(source, '{ secret password')
  await assert.rejects(startServer(app, { showOpenDialog: async () => ({ canceled: false, filePaths: [source] }) }), /^Error: The server configuration must be valid JSON\.$/)
  await assert.rejects(fs.access(path.join(data, 'server.json')))
})

test('failed child startup reports a configuration error and cleans readiness files', async t => {
  const { app, data } = await fixture(t)
  await fs.writeFile(path.join(data, 'server.json'), '{}')
  await assert.rejects(startServer(app, {}), /bundled server could not start/)
  assert.equal((await fs.readdir(data)).some(name => name.startsWith('server-start-')), false)
})
