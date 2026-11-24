# ============================================================================
# Libraries API — CRUD and install tracking
# ============================================================================
# Run:  hurl --test --variables-file vars/local.env libraries.hurl
# ============================================================================


# ── 0. Get a session token for authenticated endpoints ────────────────────────

POST {{base_url}}/api/v1/auth/session
Content-Type: application/json
{
  "localDev": true,
  "email": "{{local_dev_email}}",
  "name": "{{local_dev_name}}",
  "role": "{{local_dev_role}}"
}

HTTP 200
[Captures]
session_token: jsonpath "$.token"


# ── 1. List all libraries ────────────────────────────────────────────────────

GET {{base_url}}/libraries

HTTP 200

[Captures]
first_lib_id: jsonpath "$.collections[0].id"
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.collections" isCollection
jsonpath "$.collections" count >= 1


# ── 2. Get a single library by ID ────────────────────────────────────────────

GET {{base_url}}/libraries/{{first_lib_id}}

HTTP 200
[Asserts]
jsonpath "$.id" == "{{first_lib_id}}"
jsonpath "$.title" isString
jsonpath "$.author" isString
jsonpath "$.libraryUrl" isString


# ── 3. Install a library (requires auth) ─────────────────────────────────────

POST {{base_url}}/libraries/{{first_lib_id}}/install
Authorization: Bearer {{session_token}}

HTTP 200
[Asserts]
jsonpath "$.ok" == true


# ── 4. Install without auth → 401 ────────────────────────────────────────────

POST {{base_url}}/libraries/{{first_lib_id}}/install

HTTP 401
[Asserts]
jsonpath "$.error" contains "missing authorization"


# ── 5. Get my installed libraries ─────────────────────────────────────────────

GET {{base_url}}/libraries/me
Authorization: Bearer {{session_token}}

HTTP 200
[Asserts]
jsonpath "$.collections" isCollection
jsonpath "$.collections" count >= 1
jsonpath "$.collections[0].id" == "{{first_lib_id}}"


# ── 6. Uninstall the library ─────────────────────────────────────────────────

DELETE {{base_url}}/libraries/{{first_lib_id}}/install
Authorization: Bearer {{session_token}}

HTTP 200
[Asserts]
jsonpath "$.ok" == true


# ── 7. Verify uninstall — /me should be empty now ────────────────────────────

GET {{base_url}}/libraries/me
Authorization: Bearer {{session_token}}

HTTP 200
[Asserts]
jsonpath "$.collections" isCollection
jsonpath "$.collections" count == 0


# ── 8. Get non-existent library → 404 ────────────────────────────────────────

GET {{base_url}}/libraries/does-not-exist

HTTP 404
