# ============================================================================
# Smoke test — verify the API server is up and responding
# ============================================================================
# Run:  hurl --test --variables-file vars/local.env smoke.hurl
# ============================================================================


# ── Health: 404 on root (expected — no route) ────────────────────────────────

GET {{base_url}}/

HTTP 404


# ── CORS preflight ────────────────────────────────────────────────────────────

OPTIONS {{base_url}}/api/v2/post

HTTP 204
[Asserts]
header "Access-Control-Allow-Origin" == "*"
header "Access-Control-Allow-Methods" contains "POST"
