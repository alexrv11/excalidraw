# ============================================================================
# Share Links API — create and retrieve
# ============================================================================
# Run:  hurl --test --variables-file vars/local.env share-links.hurl
# ============================================================================


# ── 1. Create a share link ───────────────────────────────────────────────────

POST {{base_url}}/api/v2/post
Content-Type: application/octet-stream
```
{"type":"excalidraw","version":2,"elements":[]}
```

HTTP 200

[Captures]
share_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString
jsonpath "$.id" matches /^[a-f0-9]{32}$/


# ── 2. Retrieve the share link ───────────────────────────────────────────────

GET {{base_url}}/api/v2/{{share_id}}

HTTP 200
[Asserts]
header "Content-Type" contains "application/octet-stream"
body contains "excalidraw"


# ── 3. Non-existent share link → 404 ─────────────────────────────────────────

GET {{base_url}}/api/v2/0000000000000000deadbeefdeadbeef

HTTP 404


# ── 4. Empty body → 400 ──────────────────────────────────────────────────────

POST {{base_url}}/api/v2/post

HTTP 400
