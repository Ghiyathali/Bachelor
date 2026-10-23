# ASP.NET Core REST server + PostgreSQL

## Configure PostgreSQL

The API uses EF Core with the Npgsql PostgreSQL provider. Copy `.env.example` to
`.env` and enter the connection string for your Azure PostgreSQL instance. The
`.env` file is loaded only for local development and is ignored by Git. In Azure,
configure the same value as an app setting named `ConnectionStrings__Postgres`.

For an Azure Database for PostgreSQL Flexible Server, the connection string is
typically:

```dotenv
ConnectionStrings__Postgres="Host=<server>.postgres.database.azure.com;Port=5432;Database=<database>;Username=<admin-user>;Password=<password>;Ssl Mode=Require"
```

Use the database and administrator username you created. If your instance is the
legacy Single Server offering, its username may need the form
`<admin-user>@<server>`.

## Optional: start a local PostgreSQL database

```bash
docker compose up -d
```

## Create the schema and run the API

Trust the localhost development certificate once (macOS may ask for your password):

```bash
dotnet dev-certs https --trust
```

Then run:

```bash
dotnet tool restore
dotnet tool run dotnet-ef database update
dotnet run
```

The API listens at `https://localhost:5001`. Requests to `http://localhost:5002`
redirect to HTTPS. Both frontend development proxies connect to port 5001 and
accept the self-signed development certificate only for their local API target.
The frontend development pages themselves still use HTTP.

To use the local Docker database instead, set `ConnectionStrings__Postgres` in
`.env` to the local connection string shown in `.env.example`.

## Event feedback API

Listing events and submitting feedback are public and anonymous. Feedback rows
do not contain an account ID, username, email address, or other user information.
Event management and dashboard endpoints still require a JWT bearer token.

- `GET /api/events?feedbackOpenOnly=true` lists events for the feedback dropdown.
- `POST /api/events` creates an event (Admin or Event Manager).
- `PATCH /api/events/{eventId}/feedback-status` opens or closes feedback (Admin
  or Event Manager).
- `POST /api/events/{eventId}/feedback` submits overall, usefulness, and
  inclusion ratings (1-5), plus optional worked-well, improvement, and general
  comments.
- `GET /api/dashboard/satisfaction?eventId={eventId}` returns only aggregated
  1-5 rating buckets (Admin or Event Manager).
- `GET /api/dashboard/attendance?limit=10` returns only registered and attended
  totals for recent events (Admin or Event Manager). A registration remains part
  of the registered total after it is marked attended; cancelled registrations
  are excluded.

Dashboard endpoints never return individual feedback or registration rows.

In Development, `SeedDashboardDemoData` creates idempotent demo registrations
for up to six recent events so the attendance chart has representative data.
Set it to `false` in `appsettings.Development.json` to disable this behavior.

Run the requests in `rest-server.http` from top to bottom to test the complete
flow in VS Code.

The original sample CRUD endpoints remain available at `/api/todos`.
