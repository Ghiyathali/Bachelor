# Permission matrix

Role names are exact, case-sensitive values: `Admin`, `Event Manager`,
`Marketing Manager`, `Standard User`. Legacy `User` is renamed by the existing
`RenameUserRoleToStandardUser` migration; it is not an accepted alias.

| Feature | Admin | Event Manager | Marketing Manager | Standard User |
| --- | --- | --- | --- | --- |
| Home, settings, own account (`GET /api/auth/me`) | Yes | Yes | Yes | Yes |
| Dashboard overview, satisfaction, attendance, trends, event-type comparison, returning, channels, estimate | Yes | Yes | Yes | Yes |
| Export the impact report (SVG/PDF/CSV, generated in the desktop app) | Yes | Yes | Yes | No |
| Read event types | Yes | Yes | Yes | Yes |
| Create events, set event type, open/close feedback | Yes | Yes | Yes | No |
| Add, rename, delete event types | Yes | Yes | Yes | No |
| Events page: read and enter walk-ins | Yes | Yes | Yes | Yes |
| Generate/print feedback QR code | Yes | Yes | Yes | Yes |
| Run PYN sync, read last sync | Yes | Yes | Yes | No |
| Manage accounts: list, edit, activate/deactivate, reset passwords of other accounts | Yes | No | No | No |
| Edit own username/email/password ("My account" for every non-Admin role) | Yes | Yes | Yes | Yes |
| Create and delete accounts | Yes | No | No | No |
| Change roles | Yes | No | No | No |
| See and approve/decline "forgot password" requests (notification bell) | Yes | No | No | No |
| Request a new password ("Forgot password?" on the login page, no login) | Yes | Yes | Yes | Yes |
| Public event catalogue, feedback submission, community feedback total | Yes | Yes | Yes | Yes |

Only an Admin may see or edit other accounts, create/delete accounts and change roles.
Event Managers, Marketing Managers and Standard Users get 403 for every account except
their own, without a hint whether another account exists. So nobody but an Admin can
reset an Admin's password and log in as them.

**Forgot password.** `POST /api/auth/forgot-password` (`{ identifier, newPassword }`)
stores the new password as a bcrypt hash in a pending request and always answers
202 with the same message, so it cannot reveal which accounts exist. Nothing changes
until an Admin approves it (`POST /api/admin/password-requests/{id}/approve`); the
old password keeps working until then. Declining deletes the request. One pending
request per account (a new one replaces it), requests expire after 24 hours, and the
endpoint is rate limited per IP (`PasswordResetRateLimit__PermitLimit`, default 10 per minute).
Approving ends existing sessions of that account, like any password change.

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

Navigation, home shortcuts and route guards share the same role lists
(`electron-react-app/src/auth/permissions.ts`). Only Admins see Manage accounts and the
notification bell (top right) with pending password requests. Every other role sees
"My account" to change their own username, email and password. Permissions refresh from `/api/auth/me`
on protected navigation, window focus and every 15 seconds while signed in.
Session/role changes clear cached query data. The backend remains authoritative
between refreshes and when callers bypass the UI.

Event and type mutations currently have API endpoints but no desktop screens;
their authorization is enforced by the backend matrix above.

## Verification

`RoleAuthorizationTests` exercise every protected endpoint for all four roles
(`AccountPermissionTests` and `PasswordRequestTests` cover the per-account rules and
forgot-password requests),
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
