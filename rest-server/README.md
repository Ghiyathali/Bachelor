# ASP.NET Core REST server + PostgreSQL

See [the permission matrix](../PERMISSIONS.md) for roles, account administration,
and integration tests using the configured Azure test database.

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

## First start on a new database

Put the connection string of the new (empty) database in `.env` and start the app.
Nothing else is needed:

1. **The tables are created automatically** when the server starts. It only adds
   tables and columns, never deletes data, and does nothing when everything is up
   to date. Set `Database__AutoMigrate=false` to manage the tables yourself with
   `dotnet tool run dotnet-ef database update` instead.
2. **The login page shows "Set up Pangaea"** while the database has no Admin yet.
   Enter a username, email and password (8 to 72 characters) to create the first
   Admin; you are logged in straight away and can create the other accounts and
   roles under **Manage accounts**.
3. **From then on only the normal login is shown.** The server refuses any further
   "first admin" request, so nobody can use it later to make themselves Admin.

## Create an Admin from the terminal (optional)

As an alternative to the setup page, an Admin can also be created from the
terminal. Point `.env` at the database and run:

```bash
dotnet run --project rest-server -- create-admin
```

The command shows which database it will write to, then asks for the username,
email and password (the password is not shown while typing). It asks for a final
`y` before creating anything. The rules are the same as in the app: username 3 to
30 characters without `@` or spaces, a valid email, and a password of 8 to 72
characters. If the username or email already exists, nothing is created.
The password is only stored as a bcrypt hash, never in code or in the app.

After logging in, the Admin can change their password under
**Manage accounts → Edit**.

## API overview

Every endpoint the API offers, and who may call it. "Managers" means Admin, Event
Manager and Marketing Manager; "signed in" means any of the four roles (a valid JWT).
The backend checks these roles on every request; the app only hides what a role may
not use. `PERMISSIONS.md` has the full permission matrix.

### Login and accounts

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | anyone | Log in with username or email; returns a JWT (FR-15) |
| GET | `/api/auth/me` | signed in | The current account; the app re-checks it to pick up role changes |
| POST | `/api/auth/register` | Admin | Create an account with a role (FR-14) |
| POST | `/api/auth/forgot-password` | anyone, rate limited | Ask for a new password; it only works after an Admin approves it |
| GET | `/api/admin/password-requests` | Admin | Open password requests (the notification bell) |
| POST | `/api/admin/password-requests/{id}/approve` and `/decline` | Admin | Approve or decline a request |
| GET | `/api/admin/accounts` | Admin | List all accounts |
| PUT | `/api/admin/accounts/{id}` | Admin; others only their own account | Edit username, email, role and active status; only an Admin changes roles |
| PUT | `/api/admin/accounts/{id}/password` | Admin; others only their own (with the current password) | Change or reset a password |
| DELETE | `/api/admin/accounts/{id}` | Admin | Delete an account |
| GET | `/api/setup/status` | anyone | Whether the first Admin still has to be created |
| POST | `/api/setup/first-admin` | anyone, only while no Admin exists (409 after) | Create the first Admin on a new database |

### Events, feedback and walk-ins

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/api/events?feedbackOpenOnly=true` | anyone | Events; by default only those with open feedback (the form's dropdown) |
| GET | `/api/events/{id}` | anyone | One event |
| POST | `/api/events` | Managers | Create an event |
| PATCH | `/api/events/{id}/feedback-status` | Managers | Open or close feedback for an event |
| PATCH | `/api/events/{id}/event-type` | Managers | Set or clear an event's type |
| GET | `/api/events/walk-ins` | signed in | Walk-ins per event |
| PATCH | `/api/events/{id}/walk-ins` | signed in | Set the number of walk-ins for an event |
| POST | `/api/events/{eventId}/feedback` | anyone, rate limited | Submit anonymous feedback (FR-01) |
| GET | `/api/feedback/stats` | anyone | Responses this month and the monthly goal (FR-13) |
| GET | `/api/event-types` | signed in | List event types |
| POST, PUT, DELETE | `/api/event-types`, `/api/event-types/{id}` | Managers | Add, rename or delete an event type |

### Dashboard

All dashboard endpoints need a signed-in account and return only aggregated numbers,
never individual feedback or sign-ups. Groups of fewer than 5 people are returned as
`null` (NFR-02). Except for the estimate, they all accept the filter bar's query
parameters (`from`, `to`, `eventId`, `eventTypeId`, `season`, `city`, `ageBand`,
`gender`; see `Dashboard/DashboardFilter.cs`).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard/overview` | Key metrics for the tiles (FR-04) |
| GET | `/api/dashboard/filter-options` | Choices for the filter bar's dropdowns (FR-05) |
| GET | `/api/dashboard/satisfaction` | Rating distribution 1-5 (FR-06) |
| GET | `/api/dashboard/attendance?limit=10` | Signed up, accepted and walk-ins per recent event |
| GET | `/api/dashboard/trends?interval=month` | Events, feedback, satisfaction and participants per month or season (FR-07) |
| GET | `/api/dashboard/event-types` | Comparison of event types (FR-08) |
| GET | `/api/dashboard/returning` | Returning-participant percentage, overall and per type (FR-09) |
| GET | `/api/dashboard/channels` | How participants heard about Pangaea; small channels grouped into "Other" (FR-10) |
| GET | `/api/dashboard/estimate?eventTypeId=&date=` | Attendance estimate for a planned event (FR-17) |

### PYN sync

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/api/admin/pyn-sync` | Managers | Copy new events and sign-ups from PYN's database into the app's tables |
| GET | `/api/admin/pyn-sync/last` | Managers | Report of the last sync run (counts only, no personal data) |

## Event feedback API

Listing events and submitting feedback are public and anonymous. Feedback rows
do not contain an account ID, username, email address, or other user information.
Event management and dashboard endpoints still require a JWT bearer token.

- `GET /api/events?feedbackOpenOnly=true` lists events for the feedback dropdown.
- `POST /api/events` creates an event (Managers).
- `PATCH /api/events/{eventId}/feedback-status` opens or closes feedback (Managers).
- `POST /api/events/{eventId}/feedback` submits overall, usefulness, and
  inclusion ratings (1-5), plus optional worked-well, improvement, and general
  comments.
- `GET /api/dashboard/satisfaction?eventId={eventId}` returns only aggregated
  1-5 rating buckets (signed in).
- `GET /api/dashboard/attendance?limit=10` returns only the signed-up, accepted
  and walk-in counts for recent events (signed in).

Dashboard endpoints never return individual feedback or registration rows.

### Event types

Events can have an optional type (for example Workshop or Sports), used by the
type filter (FR-05) and the type comparison (FR-08). Types are stored as data,
so they can be changed in the app without a code change.

- `GET /api/event-types` lists all types (signed in).
- `POST /api/event-types`, `PUT /api/event-types/{id}` and
  `DELETE /api/event-types/{id}` add, rename and delete types (Managers).
  Deleting a type keeps its events; they simply have no type.
- `POST /api/events` accepts an optional `eventTypeId`, and
  `PATCH /api/events/{eventId}/event-type` sets or clears the type of an
  existing event (Managers).

On startup, an empty `EventTypes` table gets placeholder types (Workshop, Sports,
Cultural evening, Creative arts, Social meetup). They are based on PYN's public
events page and are meant to be renamed or replaced once PYN confirms their
categories. The seeder never changes types once any exist.

The tables, including `EventTypes`, are created or updated automatically when the API
starts (see "First start on a new database").

### Trends over time

`GET /api/dashboard/trends?interval=month&from=2035-01-01&to=2035-04-30&eventId=1`
requires a signed-in account (any role). All filters are optional; `interval` defaults to
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
