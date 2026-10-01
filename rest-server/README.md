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

```bash
dotnet tool restore
dotnet tool run dotnet-ef database update
dotnet run
```

To use the local Docker database instead, set `ConnectionStrings__Postgres` in
`.env` to the local connection string shown in `.env.example`.

## Event feedback API

All event-feedback endpoints require a JWT bearer token.

- `GET /api/events?feedbackOpenOnly=true` lists events for the feedback dropdown.
- `POST /api/events` creates an event (Admin or Event Manager).
- `PATCH /api/events/{eventId}/feedback-status` opens or closes feedback (Admin
  or Event Manager).
- `POST /api/events/{eventId}/feedback` submits a 1-5 rating and optional comment.
- `GET /api/events/{eventId}/feedback/mine` returns the current user's response.
- `GET /api/feedback/dashboard?eventId={eventId}` returns aggregate counts, the
  average rating, and responses (Admin or Event Manager).

Each user can submit feedback once per event. Run the requests in
`rest-server.http` from top to bottom to test the complete flow in VS Code.

The original sample CRUD endpoints remain available at `/api/todos`.
