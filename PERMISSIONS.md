# Permission matrix

Role names are exact, case-sensitive values: `Admin`, `Event Manager`,
`Marketing Manager`, `Standard User`. Legacy `User` is renamed by the existing
`RenameUserRoleToStandardUser` migration; it is not an accepted alias.

| Feature | Admin | Event Manager | Marketing Manager | Standard User |
| --- | --- | --- | --- | --- |
| Home, settings, own account (`GET /api/auth/me`) | Yes | Yes | Yes | Yes |
| Dashboard overview, satisfaction, attendance, trends, event-type comparison | Yes | Yes | Yes | No |
| Read event types | Yes | Yes | Yes | No |
| Create events, set event type, open/close feedback | Yes | Yes | No | No |
| Add, rename, delete event types | Yes | Yes | No | No |
| Generate/print feedback QR code | Yes | Yes | No | No |
| List/create/edit/delete accounts, assign roles, deactivate/reactivate accounts | Yes | No | No | No |
| Run PYN sync, read last sync | Yes | No | No | No |
| Public event catalogue, feedback submission, community feedback total | Yes | Yes | Yes | Yes |

The last row and login are explicitly anonymous: the standalone participant
feedback form needs them without a staff account. Event catalogue means
`GET /api/events` (including its `feedbackOpenOnly` filter) and
`GET /api/events/{id}`. Submission is `POST /api/events/{id}/feedback`;
community total is `GET /api/feedback/stats`. Submission remains rate limited.
QR generation is entirely local in the desktop UI and has no backend endpoint.

## Backend enforcement

Protected endpoints declare role authorization on the action or controller.
A fallback authentication policy protects future routes by default. Missing or
invalid tokens receive 401; active authenticated accounts with a forbidden role
receive 403. Unknown roles cannot access protected features.

Every authenticated request checks the account in the database and uses its
current role. Deactivated accounts cannot log in and existing tokens receive
401 immediately. Role changes apply to existing tokens immediately, including
403 after demotion. Reactivation permits login again. Administrators cannot
demote or deactivate themselves; another administrator must make that change.

`POST /api/auth/register` accepts an optional `role`, defaulting to Standard User.
`GET /api/admin/accounts` returns safe account summaries only.
`PUT /api/admin/accounts/{id}` accepts `{ "role": "Standard User", "isActive": false }`.
The same PUT also accepts optional `username` and `email` fields. Both are
validated and normalized to lowercase; duplicate values (case insensitive) return
409 without applying any changes. Existing sessions display updated account details.
`DELETE /api/admin/accounts/{id}` permanently deletes an account and returns 204
(404 when missing). Deleted accounts cannot log in and existing tokens receive 401.
Each row has an Edit button that opens a popup with username, email, role, active
status, Save, Cancel and Delete account. Cancel discards unsaved edits. Delete
account opens a confirmation naming the account; canceling it returns to the draft.
Administrators may edit their own username/email, but cannot delete themselves.
Unknown roles return 400. Password hashes are never returned.

Apply database migrations before deploying this API:

```sh
dotnet ef database update --project rest-server
```

`AddAccountActivation` defaults existing accounts to active.

## UI behavior

Navigation, home shortcuts and route guards share the same role lists.
Only administrators see account controls. Marketing Managers see analytics,
while Standard Users see home and settings. Permissions refresh from `/api/auth/me`
on protected navigation, window focus and every 15 seconds while signed in.
Session/role changes clear cached query data. The backend remains authoritative
between refreshes and when callers bypass the UI.

Event and type mutations and PYN sync currently have API endpoints but no desktop
screens; their authorization is enforced by the backend matrix above.

## Verification

`RoleAuthorizationTests` exercise every protected endpoint for all four roles,
assert exact 403 responses for forbidden calls, check anonymous 401 responses,
and cover account management and existing-token deactivation/demotion. A
reflection test requires explicit access metadata on every controller action.
Existing endpoint tests verify successful feature operations.

Integration tests use `ConnectionStrings__Postgres` from the environment or
`rest-server/.env` directly. The configured Azure database is the project's test
database. Tests apply migrations and write test accounts, events, feedback and
mock PYN data there. They do not create or drop Azure databases, and do not need
a separate test connection setting or database-creation permissions.
When no connection is configured (such as CI), tests fall back to Docker.

Frontend checks: `npm run typecheck`, `npm test`, and `npm run build` in
`electron-react-app`.
