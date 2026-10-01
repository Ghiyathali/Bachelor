# Pangaea Youth feedback form

A temporary anonymous React/Vite interface for submitting event feedback to
`rest-server`. It does not ask for or send account information.

## Run locally

Start the PostgreSQL database and REST server first:

```bash
cd ../rest-server
dotnet tool run dotnet-ef database update
dotnet run
```

Then start this app in another terminal:

```bash
cd feedback-form
npm install
npm run dev
```

Open <http://localhost:5174>. Vite proxies `/api` requests to
`http://localhost:5000` during development.

For a separately hosted API, create `.env.local` containing:

```dotenv
VITE_API_URL=https://your-api.example.com
```

That deployment setup also requires CORS to be configured on the REST server.
