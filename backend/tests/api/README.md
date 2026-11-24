# API Integration Tests

HTTP API tests using [Hurl](https://hurl.dev) — plain-text `.hurl` files that
chain requests, capture values, and assert responses.

## Setup

```bash
# Install Hurl (macOS)
brew install hurl

# Start the local stack
docker compose -f docker-compose.local.yml up --build
```

## Run

```bash
# From backend/
make test-api-smoke   # quick check — server up + CORS
make test-api         # full suite — auth, libraries, share links, collab

# Or run individual test files
cd tests/api
hurl --test --variables-file vars/local.env auth.hurl
hurl --test --variables-file vars/local.env libraries.hurl
```

## Files

| File | Tests |
|------|-------|
| `smoke.hurl` | Server up, CORS preflight |
| `auth.hurl` | Session create (local dev), /me, unauthorized, logout |
| `libraries.hurl` | List, get, install, uninstall, /me |
| `share-links.hurl` | Create, retrieve, 404, empty body |
| `collab-scenes.hurl` | Save, retrieve, update, 404 |

## Environments

Environment variables are in `vars/`:

- `vars/local.env` — Docker Compose stack (`localhost:8787`)

Add `vars/staging.env` or `vars/prod.env` for other environments.

## Tips

```bash
# Verbose output (see headers + body)
hurl --verbose --variables-file vars/local.env auth.hurl

# Run a single request by name (line number)
hurl --from-entry 3 --to-entry 3 --variables-file vars/local.env auth.hurl

# Generate HTML report
hurl --test --report-html report/ --variables-file vars/local.env *.hurl
```
