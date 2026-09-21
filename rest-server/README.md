# ASP.NET Core REST server + PostgreSQL

## Start PostgreSQL

```bash
docker compose up -d
```

The default connection string is in `appsettings.json`. Override it outside source control with the `ConnectionStrings__Postgres` environment variable.

## Create the schema and run the API

```bash
dotnet tool restore
dotnet tool run dotnet-ef database update
dotnet run
```

The API exposes CRUD endpoints at `/api/todos`.
