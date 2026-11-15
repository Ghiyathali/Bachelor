# Electron + React app

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts Vite and Electron, and connects to an ASP.NET API already
running at `https://localhost:5001`. The React renderer requests `/api/*`; Vite
proxies those requests to the API.

Start the API separately with `npm run dev:api`, or use `npm run dev:full` when
ports 5001 and 5002 are not already in use. Trust the local HTTPS certificate and configure PostgreSQL as described in
[`../rest-server/README.md`](../rest-server/README.md) before starting the API.

## Installers with bundled API and database defaults

```bash
npm ci
npm run dist:mac              # current Mac architecture
npm run dist:mac -- arm64     # Apple Silicon
npm run dist:mac -- x64       # Intel
npm run dist:win              # Windows x64 NSIS installer
npm run dist:win -- arm64     # Windows ARM64
```

Build with Node.js and the .NET 10 SDK installed; creating a DMG requires macOS.
The installers are written to `release/Pangaea-0.1.0-<arch>.dmg` and
`release/Pangaea-0.1.0-win-<arch>-setup.exe`. Build one platform/architecture at a
time because the staging directory is shared. Each architecture gets its own self-contained
.NET server: the recipient needs neither Node.js nor .NET installed. PostgreSQL
is still external; the DMG does not install PostgreSQL or apply migrations.
The build stages the runtime and API in `build/server`, and copies the renderer
and server into the app's Resources directory using electron-builder.

Builds include database defaults from `../rest-server/.env` automatically. Set
`PANGAEA_ENV_FILE` to use a different source file. Only
`ConnectionStrings__Postgres`, optional `ConnectionStrings__PynSource`, and
`PynSync__ViewSchema` are copied into `build/bootstrap/.env` and then the app's
`Resources/bootstrap/.env` (Windows: `resources/bootstrap/.env`). Admin-seeding
passwords, demo flags, and the source JWT key are excluded. The app generates a
private per-installation JWT key in `server-signing-key` on first launch, without
needing Keychain access or prompting for database credentials.

Install and launch: the app connects using the bundled defaults, with no manual
entry or file import. The database must be reachable, migrations already applied,
and credentials valid. Startup chooses, in order: launch environment variables,
encrypted settings saved through the dialog, bundled defaults, then the dialog.
Settings changes persist across app updates and take priority over bundled values.
An unreadable saved override opens recovery settings rather than silently
connecting to a different bundled database.

Open **Settings → Database connection → Configure connection** to replace the
connection values. If startup fails, the error dialog also opens connection
settings without requiring login or a working database. For example:
`Host=<database-host>;Database=<database>;Username=<restricted-app-user>;Password=<password>;SSL Mode=VerifyFull`.
Select **Save and restart**. Set `PANGAEA_BUNDLE_ENV=false` at build time for an
installer with no bundled credentials; a fresh installation then opens the dialog.

**The bundled `.env` is plaintext and extractable from both installers and the
installed app.** Keep its source and staging files out of Git. Share these
installers only with people permitted to hold those database credentials. Encrypting
later dialog settings does not conceal the original bundled credentials. To
rotate/remove distributed credentials, revoke or rotate them in PostgreSQL.

The connection dialog runs separately from the API. Existing secrets are never
sent to the main React renderer or displayed in the dialog. Saving replaces both
connection values; leave PYN empty to disable sync. The app generates its own
random JWT key and rotates it when the primary connection string changes. Saving
restarts the app; it does not validate network access or run migrations.

Settings are encrypted with Electron's asynchronous `safeStorage` API and saved
as `~/Library/Application Support/Pangaea/server-credentials.encrypted` on macOS
(or `%APPDATA%\Pangaea\server-credentials.encrypted` on Windows) with
permissions `0600`. On macOS the encryption key is protected by Keychain. The app
refuses to save when secure storage is unavailable. Use a properly signed release
for reliable Keychain access and identity across updates; unsigned builds may
prompt or fail to access secure storage. See [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage/).

Previously imported `server.json` files are no longer read or imported. When no
encrypted settings, launch credentials, or bundled defaults exist, the app opens the connection
dialog. Old JSON files are left untouched; remove any plaintext copies once you
have saved the connection through Settings. Never commit real credentials to Git.

### Supply credentials at launch instead

Export `ConnectionStrings__Postgres` (the PostgreSQL connection string) and
`Jwt__Key` (a random key of at least 32 bytes), then launch the app executable
directly. For example, in macOS's default zsh, prompt without writing secrets into
shell history:

```zsh
read -rs 'ConnectionStrings__Postgres?PostgreSQL connection string: '; echo
read -rs 'Jwt__Key?JWT signing key: '; echo
export ConnectionStrings__Postgres Jwt__Key
/Applications/Pangaea.app/Contents/MacOS/Pangaea
unset ConnectionStrings__Postgres Jwt__Key
```

Quit any already running Pangaea instance first. When these variables are present,
the app bypasses saved encrypted settings and bundled defaults; it passes the
variables to .NET without saving their values. Both are required together. Optional
`ConnectionStrings__PynSource` and `PynSync__ViewSchema` can also be exported.
This does not delete previously saved settings. A normal Finder launch uses saved
settings, bundled defaults, or the connection dialog because it does not inherit the Terminal
environment. Use a consistent JWT key between launches to keep existing
tokens valid. Environment variables avoid command-line arguments and app-managed
credential files, but are still accessible to the account running the app.

Electron starts the API in Production mode, waits up to 60 seconds for readiness,
and opens the UI from the same loopback HTTP origin. The OS selects a free port
on first launch and the app saves it in `server-port` to preserve browser storage
between launches. If that port later becomes occupied, stop the conflicting
process; deleting `server-port` chooses a new origin and resets visible browser
preferences/session. The child server stops when the app quits or its stdin pipe
closes. No development HTTPS certificate is needed. Production mode does not
create an initial administrator: provision accounts and run migrations through
your server administration process before distributing the app.

The server publish still excludes local configuration, development settings, source
files, SQL samples, and all `.env` files. The selected `bootstrap/.env` is an
explicit extra resource outside the server folder. Never put secrets in
`VITE_*` variables: those values become public JavaScript. Set
`VITE_FEEDBACK_URL` to the publicly hosted feedback form URL when building;
phones cannot access this loopback server. The public form still requires a
separately hosted, reachable API.

### Database credentials and deployment choice

For production with a shared database, prefer a centrally hosted API and keep
PostgreSQL credentials, the PYN read-only connection, and the JWT signing key in
the server's secret store/environment. Desktop users should receive only an API
address and authenticate with their own accounts. Shipping a local server means
the device/user can access its database and signing credentials; file permissions
or Keychain storage cannot protect them from the account running the app. A local
JWT signing key must not be trusted by a centrally hosted API.

Use this bundled mode only where directly provisioning database access to managed
machines is acceptable. Give the app a restricted database role (never an admin
or migration owner), use certificate-verified TLS, restrict network access, and
rotate credentials when a device is retired. Give PYN sync a separate read-only
role. Migrations should use a separate deployment credential.

For distribution outside your development machine, configure electron-builder's
Developer ID signing and Apple notarization credentials in the build environment.
Without those credentials the build produces an unsigned development DMG.
Certificate discovery is off by default; set `CSC_IDENTITY_AUTO_DISCOVERY=true`
to use a locally installed signing identity, or supply `CSC_LINK`/`CSC_NAME`.
See [electron-builder macOS distribution](https://www.electron.build/v26/docs/mac/)
and [.NET self-contained publishing](https://learn.microsoft.com/en-us/dotnet/core/deploying/macos).

## Renderer development build

`npm run build` builds the renderer only; `npm start` starts development Electron
and expects Vite on port 5173. Use `npm run dev` for the development app.

The Electron main process is in `electron/main.cjs`; the secure renderer bridge is in `electron/preload.cjs`.
