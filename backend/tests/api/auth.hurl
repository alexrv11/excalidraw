# ============================================================================
# Auth API — Pattern B session flow (local dev mode)
# ============================================================================
# Run:  hurl --test --variables-file vars/local.env auth.hurl
# ============================================================================


# ── 1. Create session (local dev) ─────────────────────────────────────────────
# Exchanges local dev credentials for a session JWT.

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
user_sub: jsonpath "$.user.sub"
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.token" isString
jsonpath "$.user.sub" startsWith "local|"
jsonpath "$.user.email" == "{{local_dev_email}}"
jsonpath "$.user.name" == "{{local_dev_name}}"
jsonpath "$.user.role" == "{{local_dev_role}}"


# ── 2. Get current user (/me) ────────────────────────────────────────────────
# Uses the session token from step 1.

GET {{base_url}}/api/v1/auth/me
Authorization: Bearer {{session_token}}

HTTP 200
[Asserts]
jsonpath "$.sub" == "{{user_sub}}"
jsonpath "$.email" == "{{local_dev_email}}"
jsonpath "$.name" == "{{local_dev_name}}"
jsonpath "$.role" == "{{local_dev_role}}"


# ── 3. /me without token → 401 ───────────────────────────────────────────────

GET {{base_url}}/api/v1/auth/me

HTTP 401
[Asserts]
jsonpath "$.error" contains "missing authorization"


# ── 4. /me with bad token → 403 ──────────────────────────────────────────────

GET {{base_url}}/api/v1/auth/me
Authorization: Bearer invalid.jwt.token

HTTP 403
[Asserts]
jsonpath "$.error" contains "invalid session"


# ── 5. Logout ────────────────────────────────────────────────────────────────

POST {{base_url}}/api/v1/auth/logout
Authorization: Bearer {{session_token}}

HTTP 200
[Asserts]
jsonpath "$.ok" == true


# ── 6. /me after logout — session should still validate ──────────────────────
# Note: The JWT is still valid (stateless), but the session row was deleted.
# If your backend also checks the sessions table, this would return 403.
# Currently the backend only checks the JWT, so this will return 200.

GET {{base_url}}/api/v1/auth/me
Authorization: Bearer {{session_token}}

HTTP 200
