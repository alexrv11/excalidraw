# ============================================================================
# Collab Scenes API — save and retrieve encrypted snapshots
# ============================================================================
# Run:  hurl --test --variables-file vars/local.env collab-scenes.hurl
# ============================================================================


# ── 1. Save a collab scene ───────────────────────────────────────────────────

PUT {{base_url}}/api/collab/scenes/test-room-001
Content-Type: application/json
{
  "sceneVersion": 1,
  "ciphertext": "dGVzdCBjaXBoZXJ0ZXh0",
  "iv": "dGVzdCBpdg=="
}

HTTP 200
[Asserts]
body contains "OK"


# ── 2. Retrieve the scene ────────────────────────────────────────────────────

GET {{base_url}}/api/collab/scenes/test-room-001

HTTP 200
[Asserts]
jsonpath "$.sceneVersion" == 1
jsonpath "$.ciphertext" isString
jsonpath "$.iv" isString


# ── 3. Update the scene with a newer version ─────────────────────────────────

PUT {{base_url}}/api/collab/scenes/test-room-001
Content-Type: application/json
{
  "sceneVersion": 2,
  "ciphertext": "dXBkYXRlZCBjaXBoZXJ0ZXh0",
  "iv": "dXBkYXRlZCBpdg=="
}

HTTP 200


# ── 4. Verify the update ─────────────────────────────────────────────────────

GET {{base_url}}/api/collab/scenes/test-room-001

HTTP 200
[Asserts]
jsonpath "$.sceneVersion" == 2


# ── 5. Non-existent room → 404 ───────────────────────────────────────────────

GET {{base_url}}/api/collab/scenes/room-that-does-not-exist

HTTP 404
