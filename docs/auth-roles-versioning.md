# Auth, Roles, Invite Codes, Canvas List, and Design Versioning

_2026-11-20 · Design Proposal_

## Overview

This document proposes four interconnected features for the self-hosted Excalidraw fork deployed on AWS via SST v3. Auth0 is already partially wired — `@auth0/auth0-react` is installed, `/sign-in` and `/callback` routes exist, and the Go backend validates Auth0 RS256 JWTs in `backend/internal/libraryhandler/handler.go`. The features described here extend that foundation to add: (1) a dual-mode auth middleware that accepts Auth0 JWTs in production and locally-issued dev tokens offline, (2) an invite-code gate so only invited users can register, (3) a two-role system (`user` / `admin`) with an admin portal, (4) a per-user canvas list with sharing, and (5) a versioning system that snapshots every save so teams can track how software architecture diagrams evolve over time.

## Goals

- Backend JWT middleware verifies Auth0 RS256 tokens in production and HS256 dev tokens locally, with zero code-path branching per handler.
- Registering a new Auth0 account without a valid invite code is rejected at the Auth0 Actions level and echoed back to the frontend.
- Invite codes are stored in DynamoDB with configurable `max_uses`, `expires_at`, and audit fields.
- A `Users` DynamoDB table stores role (`user` | `admin`) and is the authoritative source for the role in every backend request.
- An `/admin` frontend page, gated to admins, lets admins create/revoke invite codes, list users, and promote/demote roles.
- Each authenticated user owns a list of named canvases stored in a `Canvases` DynamoDB table.
- Canvases can be shared with other users as `viewer` or `editor`.
- Every explicit save writes a new version row to `CanvasVersions` (DynamoDB metadata) and a full scene snapshot to S3 under `versions/<canvasId>/<versionNumber>.json`.
- Users can browse a version timeline and restore any snapshot.
- A side-by-side diff view highlights which Excalidraw elements were added, removed, or changed between two chosen versions.
- Retention: a configurable maximum version count per canvas (default 100); older versions are pruned on save.

## Non-goals

- OAuth provider changes — the design does not add or remove Auth0 social connections (Google, GitHub) already configured in the Auth0 dashboard.
- Fine-grained canvas permissions beyond `viewer` / `editor` / `owner`.
- Real-time collaborative versioning — versions capture single-user saves, not collab session merges.
- Full text search across canvas content.
- Billing or usage quotas.
- Mobile app.

---

## Data Model

All new tables follow the existing SST naming convention: `sst.aws.Dynamo("PascalCase", ...)` produces an env var `PASCAL_CASE_TABLE`.

### Users table — `sst.aws.Dynamo("Users", ...)`

Env var: `USERS_TABLE`

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `sub` | string | PK (hash) | Auth0 `sub` claim, e.g. `auth0|abc123` |
| `email` | string | | Copied from Auth0 token on first sign-in |
| `name` | string | | Display name |
| `role` | string | | `"user"` or `"admin"` |
| `createdAt` | string | | ISO 8601 |
| `inviteCode` | string | | The code used to register (audit trail) |

GSI `byEmail`: hash key `email` — used by admin user-lookup.

Auto-provisioned on first successful authenticated request (upsert). Role defaults to `"user"`.

### InviteCodes table — `sst.aws.Dynamo("InviteCodes", ...)`

Env var: `INVITE_CODES_TABLE`

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `code` | string | PK (hash) | Random URL-safe string, e.g. 12 chars base62 |
| `createdBy` | string | | Admin `sub` who generated it |
| `maxUses` | number | | `1` for single-use, higher for multi-use, `0` = unlimited |
| `currentUses` | number | | Atomically incremented on redemption |
| `expiresAt` | string | | ISO 8601 or empty for no expiry |
| `revoked` | bool | | Soft-delete; set by admin |
| `usedBy` | string[] | | Array of `sub` values that redeemed this code |
| `note` | string | | Optional admin annotation |
| `createdAt` | string | | ISO 8601 |

### Canvases table — `sst.aws.Dynamo("Canvases", ...)`

Env var: `CANVASES_TABLE`

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `canvasId` | string | PK (hash) | ULID, e.g. `01ARZ3NDEKTSV4RRFFQ69G5FAV` |
| `ownerId` | string | | `sub` of the owner |
| `title` | string | | User-editable name |
| `thumbnailKey` | string | | S3 key, e.g. `thumbnails/<canvasId>.png` |
| `latestVersionNumber` | number | | Monotonically increasing |
| `createdAt` | string | | ISO 8601 |
| `updatedAt` | string | | ISO 8601, updated on each save |

GSI `byOwner`: hash key `ownerId`, range key `updatedAt` — used for the user's canvas list ordered by recency.

### CanvasShares table — `sst.aws.Dynamo("CanvasShares", ...)`

Env var: `CANVAS_SHARES_TABLE`

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `canvasId` | string | PK (hash) | |
| `sharedWithSub` | string | SK (range) | The user being granted access |
| `permission` | string | | `"viewer"` or `"editor"` |
| `grantedAt` | string | | ISO 8601 |

GSI `bySharedWith`: hash key `sharedWithSub` — used to list canvases shared with me.

### CanvasVersions table — `sst.aws.Dynamo("CanvasVersions", ...)`

Env var: `CANVAS_VERSIONS_TABLE`

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `canvasId` | string | PK (hash) | |
| `versionNumber` | number | SK (range) | 1-based, monotonically increasing |
| `authorSub` | string | | `sub` of the user who saved |
| `message` | string | | Optional commit-style description |
| `s3Key` | string | | `versions/<canvasId>/<versionNumber>.json` |
| `elementCount` | number | | Stored for diff summary in the timeline |
| `fileSizeBytes` | number | | For storage reporting |
| `createdAt` | string | | ISO 8601 |

No GSI needed — queries always filter by `canvasId` and optionally paginate by `versionNumber` range.

**S3 layout (existing `Files` bucket):**

```
versions/<canvasId>/<versionNumber>.json   — full Excalidraw scene JSON
thumbnails/<canvasId>.png                  — latest thumbnail (overwritten on save)
```

---

## Architecture

```
Browser
  │
  ├─ /canvases          → CanvasListPage
  ├─ /canvases/:id      → CanvasEditorPage (wraps Excalidraw component)
  ├─ /canvases/:id/history → VersionHistoryPage
  ├─ /admin             → AdminPage (role-gated)
  ├─ /sign-in           → SignInPage (existing, extended with invite code input)
  └─ /callback          → AuthCallback (existing)

Vite dev server
  │
  VITE_APP_AWS_API_URL ──► API Gateway HTTP (sst.aws.ApiGatewayV2)
                              │
                    ┌─────────┼─────────────────────────────┐
                    │         │                             │
             ┌──────▼──┐ ┌───▼──────┐ ┌──────────────┐ ┌──▼──────────┐
             │ auth    │ │ canvases │ │ canvas-      │ │ admin       │
             │ Lambda  │ │ Lambda   │ │ versions     │ │ Lambda      │
             │         │ │          │ │ Lambda       │ │             │
             └──────┬──┘ └───┬──────┘ └──────┬───────┘ └──┬──────────┘
                    │        │               │             │
             ┌──────▼────────▼───────────────▼─────────────▼──────┐
             │                   DynamoDB                          │
             │  Users  InviteCodes  Canvases  CanvasVersions       │
             │  CanvasShares                                       │
             └─────────────────────────────────────────────────────┘
                    │        │               │
             ┌──────▼────────▼───────────────▼──────┐
             │               S3 (Files bucket)       │
             │   versions/<cid>/<vn>.json            │
             │   thumbnails/<cid>.png                │
             └───────────────────────────────────────┘

Auth0 (production)         Local dev JWT issuer
  │                              │
  Auth0 Action: validate        backend/cmd/dev-token
  invite code on signup          issues HS256 tokens
                                 signed with LOCAL_JWT_SECRET
```

### JWT middleware strategy

A new Go package `backend/internal/auth` exposes a single function:

```go
func VerifyToken(req events.APIGatewayV2HTTPRequest) (Claims, error)
```

`Claims` carries `Sub`, `Email`, `Role`. The function inspects the token header:
- If `alg == RS256` and `AUTH0_DOMAIN` is set: validate against Auth0 JWKS (existing logic from `libraryhandler`), then hydrate `Role` from the `Users` DynamoDB table (or from a custom `https://excalidraw.ventulab.com/role` claim injected by Auth0 Actions).
- If `alg == HS256` and `LOCAL_JWT_SECRET` is set: validate with the shared secret, trust all claims from the payload (including `role`).
- Otherwise: return `401`.

This keeps every handler's auth call identical regardless of environment.

---

## API Design

All new endpoints live under `/api/v1/` to distinguish them from the existing `/api/v2/` share-link namespace. Requests use `events.APIGatewayV2HTTPRequest`. Auth is enforced by calling `auth.VerifyToken(req)` at the top of each handler.

### Auth endpoints — `backend/cmd/auth/main.go`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Validates invite code, upserts a `Users` row, returns `{ ok: true }`. Called from Auth0 Action after successful signup. |
| `GET` | `/api/v1/auth/me` | JWT | Returns the caller's `Users` row: `{ sub, email, name, role }`. Frontend uses this to know the role without decoding the JWT. |

### Local dev token endpoint (non-Lambda, in `api-local` only)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/dev-token` | None | Body: `{ sub, email, name, role }`. Response: `{ token }`. Only available when `LOCAL_JWT_SECRET` is set. |

### Invite code endpoints — `backend/cmd/admin/main.go`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/invites` | JWT + admin | List all invite codes with usage stats |
| `POST` | `/api/v1/admin/invites` | JWT + admin | Create a new invite code. Body: `{ maxUses, expiresAt?, note? }` → `{ code }` |
| `DELETE` | `/api/v1/admin/invites/:code` | JWT + admin | Revoke a code |

### User management — `backend/cmd/admin/main.go`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/users` | JWT + admin | Paginated user list. `?cursor=&limit=50` |
| `PATCH` | `/api/v1/admin/users/:sub/role` | JWT + admin | Body: `{ role: "user" \| "admin" }` |

### Canvas endpoints — `backend/cmd/canvases/main.go`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/canvases` | JWT | List the caller's owned + shared canvases. `?cursor=&limit=20` |
| `POST` | `/api/v1/canvases` | JWT | Create a canvas. Body: `{ title }` → `CanvasSummary` |
| `GET` | `/api/v1/canvases/:canvasId` | JWT | Get metadata for one canvas (checks ownership or share permission) |
| `PATCH` | `/api/v1/canvases/:canvasId` | JWT | Update `title` only. Body: `{ title }` |
| `DELETE` | `/api/v1/canvases/:canvasId` | JWT | Delete canvas and all versions (cascades async via SQS or synchronous for small counts) |
| `GET` | `/api/v1/canvases/:canvasId/scene` | JWT | Fetch the latest scene JSON (redirects to presigned S3 URL or streams inline) |
| `PUT` | `/api/v1/canvases/:canvasId/scene` | JWT | Save a new version. Body: `{ sceneJSON, thumbnailPNG?, message? }` → `{ versionNumber }` |
| `POST` | `/api/v1/canvases/:canvasId/shares` | JWT + owner | Grant access. Body: `{ email, permission }` → `{ ok: true }` |
| `DELETE` | `/api/v1/canvases/:canvasId/shares/:sub` | JWT + owner | Revoke access |

### Version endpoints — `backend/cmd/canvases/main.go` (same handler, path-routed)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/canvases/:canvasId/versions` | JWT | Paginated version list (metadata only). `?cursor=&limit=50` |
| `GET` | `/api/v1/canvases/:canvasId/versions/:versionNumber` | JWT | Metadata + presigned S3 URL for the full scene JSON |
| `POST` | `/api/v1/canvases/:canvasId/versions/:versionNumber/restore` | JWT + editor | Creates a new version that is a copy of the target version |

### Response shapes (abbreviated)

```json
// CanvasSummary (list item)
{
  "canvasId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "title": "Microservices v3",
  "ownerId": "auth0|abc",
  "thumbnailUrl": "https://…/thumbnails/…",
  "latestVersionNumber": 12,
  "updatedAt": "2026-11-20T10:00:00Z",
  "myPermission": "owner"
}

// VersionSummary (list item)
{
  "canvasId": "…",
  "versionNumber": 12,
  "authorSub": "auth0|abc",
  "message": "added Redis cluster",
  "elementCount": 47,
  "fileSizeBytes": 18432,
  "createdAt": "2026-11-20T10:00:00Z",
  "sceneUrl": "https://s3.presigned/…"   // only on single-version GET
}
```

---

## Frontend Pages and Components

The app's routing is currently a chain of `window.location.pathname` checks in `ExcalidrawApp` in `excalidraw-app/App.tsx`. New pages are added to that switch.

### New pages (`excalidraw-app/pages/`)

| File | Route | Description |
|---|---|---|
| `CanvasList.tsx` | `/canvases` | Grid of canvas cards with thumbnail, title, last-edited date. "New canvas" button. |
| `CanvasEditor.tsx` | `/canvases/:id` | Thin wrapper: loads the scene from the API into the existing `ExcalidrawWrapper`, auto-saves on the `onChange` debounce, renders the versioning toolbar. |
| `VersionHistory.tsx` | `/canvases/:id/history` | Timeline sidebar showing version list; clicking a version shows a preview and optional diff against another selected version. |
| `Admin.tsx` | `/admin` | Tabs for Invite Codes and Users. Admin-only; redirect to `/` if role is not `admin`. |

### New components (`excalidraw-app/components/`)

| File | Description |
|---|---|
| `SaveStatusIndicator.tsx` | Shows "Saved", "Saving…", or "Unsaved changes" in the canvas toolbar. |
| `VersionToolbar.tsx` | Rendered inside the canvas editor. Shows current version number, a "History" link, and optionally a commit message input before saving. |
| `CanvasCard.tsx` | Thumbnail card for the canvas list grid. |
| `DiffViewer.tsx` | Side-by-side two-panel view for version comparison; left panel renders version A, right panel renders version B. Added/removed elements highlighted in green/red overlay. |
| `InviteCodeTable.tsx` | Admin table of invite codes with usage, expiry, and revoke action. |
| `UserTable.tsx` | Admin paginated table of users with role badge and change-role dropdown. |

### Auth hook changes

A new `useCurrentUser` hook (`excalidraw-app/hooks/useCurrentUser.ts`) calls `GET /api/v1/auth/me` once after `isAuthenticated` becomes true and caches the result in React context. It exposes `{ sub, email, name, role, isAdmin }`. All role-gated UI reads from this hook rather than decoding the JWT on the frontend.

### Sign-in page changes

The existing `excalidraw-app/pages/SignIn.tsx` gains an invite-code input field that is shown only when the user is registering for the first time (detected via `isAuthenticated === false` and a `?register=1` param or similar). The code is passed as `appState.inviteCode` in the Auth0 `loginWithRedirect` call; Auth0 Actions pick it up from the authorization request.

---

## Implementation Plan

### Phase 1 — Auth middleware and Users table (prerequisite for everything else)

1. **`backend/internal/auth/auth.go`** — New package. Move `verifyJWT`/`bearerToken`/JWKS logic out of `libraryhandler/handler.go` into this package. Add HS256 branch for `LOCAL_JWT_SECRET`. Expose `VerifyToken(req) (Claims, error)` where `Claims` = `{ Sub, Email, Name, Role string }`. Role is read from DynamoDB `Users` table after signature verification.

2. **`sst.config.ts`** — Add `Users` and `InviteCodes` tables. Pass `USERS_TABLE` and `INVITE_CODES_TABLE` env vars to all Lambda functions that need them. Add `LOCAL_JWT_SECRET` to the SST environment (non-production only) and to `.env.development.local.example`.

3. **`backend/internal/libraryhandler/handler.go`** — Replace the inlined `verifyJWT`/`bearerToken` calls with `auth.VerifyToken(req)`.

4. **`docker/setup.mjs`** — Add `createDdbTable` calls for `Users`, `InviteCodes`, `Canvases`, `CanvasShares`, `CanvasVersions`.

5. **`docker-compose.local.yml`** — Add `USERS_TABLE`, `INVITE_CODES_TABLE`, `LOCAL_JWT_SECRET` env vars to the `api` service. Add `CANVAS_VERSIONS_TABLE`, `CANVASES_TABLE`, `CANVAS_SHARES_TABLE` as well so the full stack boots cleanly.

6. **`backend/cmd/auth/main.go`** — New Lambda: `POST /api/v1/auth/register` and `GET /api/v1/auth/me`. Register validates the invite code (DynamoDB conditional update on `currentUses < maxUses`) and upserts the Users row. Me returns the caller's Users row hydrated with role.

7. **`backend/cmd/api-local/main.go`** — Add routes for `/api/v1/auth/register`, `/api/v1/auth/me`, and the `POST /api/v1/dev-token` local-only endpoint. The dev-token endpoint reads `LOCAL_JWT_SECRET` from env and signs an HS256 JWT with the posted claims.

8. **`sst.config.ts`** — Wire `GET /api/v1/auth/me` and `POST /api/v1/auth/register` → `goFn("auth", ...)`.

9. **`excalidraw-app/hooks/useCurrentUser.ts`** — New hook. Calls `/api/v1/auth/me` once on mount when authenticated; stores result in a React context provider added to `App.tsx`.

10. **`excalidraw-app/App.tsx`** — Wrap the app with `CurrentUserProvider`. Add `/admin` route (guarded).

### Phase 2 — Invite codes and registration gate

11. **Auth0 Action** — "Pre User Registration" or "Post Login" Action (configured in the Auth0 dashboard, not in this repo) calls `POST /api/v1/auth/register` with `{ inviteCode, sub, email, name }`. On error (invalid/expired code) it returns `{ error: "INVALID_INVITE_CODE" }` and Auth0 blocks the signup. Document this in a `docs/auth0-setup.md` ops runbook (out of scope for this proposal but noted as a deliverable).

12. **`excalidraw-app/pages/SignIn.tsx`** — Add an invite code input field and explanatory copy. Pass the code through `loginWithRedirect({ appState: { inviteCode } })`. If Auth0 returns an error with code `INVALID_INVITE_CODE`, display a friendly error message.

13. **`backend/cmd/admin/main.go`** — New Lambda: invite code and user management endpoints listed in the API section. Admin check: `claims.Role != "admin"` → 403.

14. **`sst.config.ts`** — Wire `GET|POST /api/v1/admin/invites`, `DELETE /api/v1/admin/invites/{code}`, `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/{sub}/role` → `goFn("admin", ...)`.

15. **`excalidraw-app/pages/Admin.tsx`** — Admin page with Invite Codes and Users tabs. Uses `useCurrentUser` to gate access. `InviteCodeTable` and `UserTable` components.

### Phase 3 — Canvas list

16. **`backend/cmd/canvases/main.go`** — New Lambda handling all `/api/v1/canvases` and `/api/v1/canvases/{proxy+}` routes. Canvas CRUD, share management, and version read operations.

17. **`sst.config.ts`** — Add `Canvases`, `CanvasShares`, `CanvasVersions` DynamoDB tables. Wire canvas routes to the `canvases` Lambda. Grant the Lambda `link` access to the `Files` S3 bucket for presigned URL generation and thumbnail writes.

18. **`backend/Makefile`** — Add `auth`, `admin`, `canvases` to `HTTP_CMDS`.

19. **`excalidraw-app/pages/CanvasList.tsx`** — Canvas list page with `CanvasCard` grid, "New canvas" action, and tabs for "My canvases" / "Shared with me".

20. **`excalidraw-app/App.tsx`** — Add `/canvases` and `/canvases/` prefix routes to the pathname switch.

### Phase 4 — Canvas editor integration

21. **`excalidraw-app/pages/CanvasEditor.tsx`** — New page at `/canvases/:id`. On mount, calls `GET /api/v1/canvases/:id/scene` to fetch the latest scene JSON and passes it as `initialData` to the `Excalidraw` component. On save (triggered by `Excalidraw`'s `onChange` debounce or explicit "Save" action), calls `PUT /api/v1/canvases/:id/scene` with the serialized scene and an optional commit message captured via `VersionToolbar`.

22. **`excalidraw-app/components/VersionToolbar.tsx`** — Minimal bar rendered via `renderTopRightUI` or as a custom panel insert; shows current version number, save status (via `SaveStatusIndicator`), "View history" link, and an optional message input.

23. **Auto-save debounce** — Reuse the existing `debounce` import from `@excalidraw/common`. Target: save 3 seconds after the last `onChange` event while the tab is focused; also save on `beforeunload`.

### Phase 5 — Version history and diff view

24. **`excalidraw-app/pages/VersionHistory.tsx`** — Timeline of versions. Each row shows version number, author, timestamp, element count, and optional message. Clicking "View" loads that version's scene JSON (fetched from the presigned S3 URL) into a read-only `Excalidraw` preview panel.

25. **`excalidraw-app/components/DiffViewer.tsx`** — Two-pane component. Each pane renders a read-only `Excalidraw` instance. The diff logic compares the two scenes' `elements` arrays by `id`: elements present only in the left scene are highlighted red; elements only in the right scene are highlighted green; elements in both but with changed properties are highlighted yellow. Highlighting is achieved by passing a custom `renderEmbeddable` or by overlaying a colored SVG rectangle matched to each element's bounding box. The comparison is done in-browser — no backend diff endpoint is needed.

26. **Version retention pruning** — Inside `PUT /api/v1/canvases/:id/scene`, after writing the new version, query the total version count. If it exceeds the configured maximum (`CANVAS_MAX_VERSIONS` env var, default `100`), delete the oldest rows from `CanvasVersions` and their corresponding S3 objects.

### Phase 6 — Local dev integration

27. **`.env.development.local.example`** — Add `VITE_APP_LOCAL_AUTH=true`, `LOCAL_JWT_SECRET=dev-secret-change-me`, and table names for the new tables.

28. **`docker/setup.mjs`** — Extend to create the new DynamoDB tables and seed a default admin user (sub `local|admin`, role `admin`, no invite code required) and a default invite code (`DEV-INVITE-001`, unlimited uses) for local onboarding.

29. **`excalidraw-app/hooks/useLocalAuth.ts`** — When `VITE_APP_LOCAL_AUTH=true`, expose a `signInAsLocalUser(role)` helper that calls `POST /api/v1/dev-token` and stores the resulting JWT in `localStorage`. `useCurrentUser` checks `localStorage` before calling Auth0 so the full canvas and admin flow is exercisable without real Auth0 credentials.

---

## Open Questions

1. **Auth0 Action vs. backend register call.** The invite-code validation can happen in an Auth0 Pre-Registration Action (serverless JS inside Auth0 that calls our `/api/v1/auth/register`) or entirely post-login (Action fires after login, we validate then, but the account is already created). Pre-registration blocks account creation more cleanly. Which timing is preferred?

2. **Role in JWT vs. role from DynamoDB.** Two options: (a) encode `role` as a custom claim in the Auth0 token via an Auth0 Post-Login Action and read it from the JWT payload in every Lambda (fast, no DDB read per request, but role changes don't take effect until token rotation); (b) always read role from `Users` DynamoDB on each protected request (always current, one extra DDB read per call). Which is preferred? The design currently does (b) with a note that (a) can be layered on top.

3. **Canvas deletion cascade.** Deleting a canvas with many versions means deleting N S3 objects and N DynamoDB rows. For large version counts this could exceed Lambda timeout. Should deletions be synchronous (acceptable for small counts, say up to `max_versions`) or should they go through an async mechanism (SQS + a background Lambda)?

4. **Thumbnail generation.** The proposal has the browser send a `thumbnailPNG` blob on each save (the Excalidraw `exportToCanvas` API can produce this). An alternative is a server-side headless render. Browser-side is simpler and keeps the Lambda stateless. Is client-side thumbnail generation acceptable?

5. **`max_versions` per canvas.** The proposal suggests a global default of 100 configurable via `CANVAS_MAX_VERSIONS`. Should this be per-user or per-canvas as well? Per-canvas would require another DynamoDB attribute and admin UI surface.

6. **Canvas ID generation.** The proposal uses ULIDs (sortable, URL-safe). The repo currently uses hex-encoded random bytes for share link IDs. Should ULIDs be introduced as a dependency (`github.com/oklog/ulid`) or is a simple `crypto/rand` hex ID acceptable for canvases too?

7. **Diff visualization approach.** The two-pane `Excalidraw` preview diff is easy to build but only visual — it shows what the diagram looks like, not a structured element diff. Would a structural diff (a collapsible list of "added X elements, removed Y, changed Z properties") in addition to or instead of the visual diff be more useful for tracking architecture evolution?

8. **Initial admin bootstrap.** For the production deployment, the first admin user has no one to give them an invite code. The proposal seeds a `DEV-INVITE-001` code in `docker/setup.mjs` for local dev. For production, should there be a one-time `POST /api/v1/admin/bootstrap` endpoint protected by a `BOOTSTRAP_SECRET` env var, or should the first admin be provisioned via a manual DynamoDB write documented in an ops runbook?
