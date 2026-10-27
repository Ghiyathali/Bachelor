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

### Trends over time

`GET /api/dashboard/trends?interval=month&from=2035-01-01&to=2035-04-30&eventId=1`
requires Admin or Event Manager. All filters are optional; `interval` defaults to
`month` and also accepts `season`. Dates filter the event's start date in UTC,
including both boundary dates. Without dates the range spans matching events.
Explicit dates preserve leading/trailing gaps. Ranges are limited to 100 years.

Each period contains `periodStart`, `eventCount`, `feedbackResponses`,
`averageSatisfaction`, and `participants`. Participants count Accepted sign-ups
(status 1), matching the overview. Satisfaction is the mean of all feedback
ratings for matching events, regardless of submission date. Seasons use the
same response-weighted mean, rather than averaging monthly averages. Winter
starts December 1 of the previous year, spring March 1, summer June 1, and
autumn September 1. Date filters can select only part of a season.

No events means null participants; events with no Accepted sign-ups mean zero.
No feedback means null satisfaction. The D3 chart breaks each line at nulls,
marks missing values with crosses, and provides an accessible values table.
Its event/date filters apply to both series; the other dashboard cards retain
their existing scope.

`TrendsEndpointTests` compare the endpoint against independent monthly SQL on
controlled data covering gaps, unequal response counts, UTC boundaries, and filters.
Tests use the existing Docker-based PostgreSQL setup.

Demo data seeding is off by default, including in Development. To opt in, set
the following in `rest-server/.env` (or as an environment variable):

```dotenv
SeedDemoData=true
```

In Development, this creates demo sign-ups for up to six recent events and fills
missing demographics with mock answers. Leave it unset or set to `false` when
using the shared Azure database to keep startup from changing demo data and
dashboard numbers. First-admin creation is configured separately by `SeedAdmin`.

Run the requests in `rest-server.http` from top to bottom to test the complete
flow in VS Code.
