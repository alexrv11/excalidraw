# Libraries API Design

_2026-11-12 · Alex Ventura_

## Overview

The Libraries API exposes collections of Excalidraw icon libraries stored in the backend, so the Libraries page and future clients can fetch, search, and add collections dynamically instead of depending on a static `manifest.json` baked into the frontend build.

Goals:

- Serve `GET /libraries` — paginated list of all public collections with metadata and preview URLs
- Serve `GET /libraries/:id` — single collection with full item list
- Support `GET /libraries?q=` search by title, author, tags
- Allow authenticated users to `POST /libraries/:id/install` to record an install (download count + user library association)
- Keep the static seed-script output (`manifest.json`) as a fallback for offline / build-time use

## Data Model

**Collection** — one library pack (e.g. "Design System Architecture")

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | URL-safe slug, e.g. `design-system-architecture` |
| `title` | string | Display name |
| `description` | string | One-line summary |
| `author` | string | Display name |
| `authorUrl` | string | Profile link |
| `tags` | string[] | For search/filter, e.g. `["design", "ui"]` |
| `downloads` | number | Total install count |
| `libraryUrl` | string | Path to `.excalidrawlib` file |
| `createdAt` | ISO date | |
| `updatedAt` | ISO date | |

**Item** — one icon inside a collection

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Slug, e.g. `dsa-component` |
| `name` | string | Display name |
| `previewUrl` | string | Path to SVG preview |

The `.excalidrawlib` binary and SVG previews live in S3/CloudFront. The API returns URLs pointing to them — it does not serve the files directly.

## Architecture

```
         ┌──────────────┐
         │   Browser    │
         └──────┬───────┘
        GET /   │          file downloads
      libraries │         (.excalidrawlib · SVG)
                │                │
    ┌───────────▼──────┐  ┌──────▼──────────┐
    │   API Gateway    │  │   CloudFront     │
    │   HTTP API       │  │   CDN            │
    └───────────┬──────┘  └──────▲──────────┘
                │                │ origin
    ┌───────────▼──────┐  ┌──────┴──────────┐
    │   Go Lambda      ├──►   DynamoDB       │
    │   libraries      │  │   Libraries      │
    │   handler        │  │   table          │
    └──────────────────┘  └─────────────────-┘
                                 S3 Bucket
                          libraries/{id}.excalidrawlib
                          libraries/previews/{id}/*.svg
```

The client calls the HTTP API for collection metadata. Lambda reads DynamoDB and returns CloudFront URLs for the binary files. The client fetches `.excalidrawlib` files and SVG previews directly from CloudFront, keeping large file traffic off the Lambda. The seed script populates DynamoDB and S3 on each deploy.

## Endpoints

| Method | Path | Auth | Description | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/libraries` | Public | List all collections, paginated. Supports `?q=` (search title/author/tags), `?tag=`, `?limit=` (default 20), `?cursor=` | `{ collections: Collection[], nextCursor? }` |
| `GET` | `/libraries/:id` | Public | Single collection with full item list | `Collection` |
| `POST` | `/libraries/:id/install` | JWT | Record an install for the authenticated user; increments `downloads` counter | `{ ok: true }` |
| `GET` | `/libraries/me` | JWT | Collections the authenticated user has installed | `{ collections: Collection[] }` |

All responses are `application/json`. Error shape: `{ error: string, code: string }`.

`Collection` in list responses omits `items` (only metadata + `itemCount`). `GET /libraries/:id` includes the full `items` array.

## Storage

**DynamoDB — `Libraries` table** holds collection metadata and item lists. It is the source of truth for the API.

| Attribute | Key type | Notes |
| --- | --- | --- |
| `id` | Partition key | Collection slug |
| `title`, `description`, `author`, `authorUrl`, `tags` | — | Searchable metadata |
| `downloads` | — | Atomic counter, incremented on install |
| `libraryUrl`, `items` | — | CloudFront URLs; `items` is a list of `{ id, name, previewUrl }` |
| `createdAt`, `updatedAt` | — | ISO strings |

A GSI on `tags` (hash) + `downloads` (range) supports `?tag=` filtered listing sorted by popularity.

**S3 — existing files bucket** stores the binary assets.

| Path | Contents |
| --- | --- |
| `libraries/{id}.excalidrawlib` | The Excalidraw library file |
| `libraries/previews/{id}/{itemId}.svg` | Per-icon SVG previews |

The seed script (`pnpm seed:libraries`) already writes these paths. On deploy it should also upsert the DynamoDB record for each collection it generates.

## Auth

**Public endpoints** (`GET /libraries`, `GET /libraries/:id`) require no token. Any client — including unauthenticated visitors and the seed script — can read the library catalogue.

**Protected endpoints** (`POST /libraries/:id/install`, `GET /libraries/me`) require a valid Auth0 JWT in the `Authorization: Bearer <token>` header. The Lambda verifies the token against the Auth0 JWKS endpoint (`https://{domain}/.well-known/jwks.json`) and reads the `sub` claim as the user ID.

The frontend sends the token from `useAuth0().getAccessTokenSilently()`. No token = `401`. Invalid token = `403`.

## Implementation Plan

**1. DynamoDB table** — add a `Libraries` table to `sst.config.ts` with the partition key `id` and the `tags`+`downloads` GSI. Pass it to the Lambda as an env var.

**2. Go Lambda** — create `backend/cmd/libraries/main.go`. Route on `method + path`:

- `GET /libraries` → scan/query DynamoDB, support `q` and `tag` params, return paginated list (no `items`)
- `GET /libraries/:id` → `GetItem`, return full collection including `items`
- `POST /libraries/:id/install` → verify JWT, `UpdateItem` to increment `downloads`, write a user-install record
- `GET /libraries/me` → verify JWT, query user-install records, batch-get collections

**3. SST wiring** — add the route in `sst.config.ts`:

```ts
new sst.aws.ApiGatewayV2LambdaRoute("LibrariesRoute", {
  api: httpApi,
  method: "ANY",
  path: "/libraries/{proxy+}",
  handler: "./backend/cmd/libraries",
  environment: { LIBRARIES_TABLE: librariesTable.name },
})
```

**4. Seed script update** — after writing the `.excalidrawlib` and SVG files to S3, upsert the DynamoDB record for each collection using the AWS SDK. Add `AWS_PROFILE=alex` to the `seed:libraries` script.

**5. Frontend update** — update `Libraries.tsx` to call `GET /libraries` from `VITE_APP_AWS_API_URL` instead of fetching the static `manifest.json`. Keep the static fetch as a fallback for local dev without AWS credentials.
