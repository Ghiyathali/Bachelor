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

## macOS installer with bundled API

```bash
npm ci
npm run dist:mac              # current Mac architecture
npm run dist:mac -- arm64     # Apple Silicon
npm run dist:mac -- x64       # Intel
```

Build on macOS with Node.js and the .NET 10 SDK installed. The DMG is written to
`release/Pangaea-0.1.0-<arch>.dmg`. Each architecture gets its own self-contained
.NET server: the recipient needs neither Node.js nor .NET installed. PostgreSQL
is still external; the DMG does not install PostgreSQL or apply migrations.
The build stages the runtime and API in `build/server`, and copies the renderer
and server into the app's Resources directory using electron-builder.

Copy the app into Applications. At first launch, select an administrator-provided
JSON file based on [`server.example.json`](server.example.json). Replace every
placeholder, including the JWT key (generate one with `openssl rand -base64 48`).
The app copies it to `~/Library/Application Support/Pangaea/server.json` with
permissions `0600`. Quit the app before editing/replacing that file. Do not send
the completed file through Git, email, or the installer; provision it through
your organisation's secure credential delivery process. Delete any temporary
source copy after provisioning. The template contains no working credentials.

Electron starts the API in Production mode, waits up to 60 seconds for readiness,
and opens the UI from the same loopback HTTP origin. The OS selects a free port
on first launch and the app saves it in `server-port` to preserve browser storage
between launches. If that port later becomes occupied, stop the conflicting
process; deleting `server-port` chooses a new origin and resets visible browser
preferences/session. The child server stops when the app quits or its stdin pipe
closes. No development HTTPS certificate is needed. Production mode does not
create an initial administrator: provision accounts and run migrations through
your server administration process before distributing the app.

Local configuration, `.env` files, development settings, source files, and SQL
samples are excluded from the staged server/installer. Never put secrets in
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
