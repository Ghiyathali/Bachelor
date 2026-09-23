# Electron + React app

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts Vite and Electron, and connects to an ASP.NET API already
running at `http://localhost:5000`. The React renderer requests `/api/*`; Vite
proxies those requests to the API.

Start the API separately with `npm run dev:api`, or use `npm run dev:full` when
port 5000 is not already in use. Configure PostgreSQL as described in
[`../rest-server/README.md`](../rest-server/README.md) before starting the API.

For a packaged desktop app, set `VITE_API_URL` to the deployed API's origin at
build time, for example `VITE_API_URL=https://api.example.com npm run build`.

## Production build

```bash
npm run build
npm start
```

The Electron main process is in `electron/main.cjs`; the secure renderer bridge is in `electron/preload.cjs`.
