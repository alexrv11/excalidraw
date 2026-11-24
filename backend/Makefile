HTTP_CMDS := sharelinks-post sharelinks-get collabscenes-get collabscenes-put files-put files-get libraries auth
WS_CMDS   := ws-connect ws-disconnect ws-join-room ws-broadcast ws-volatile ws-user-follow
CMDS      := $(HTTP_CMDS) $(WS_CMDS)

.PHONY: build build-local clean tidy $(CMDS)

build: $(CMDS)

$(CMDS):
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
		-ldflags="-s -w" \
		-o dist/$@/bootstrap \
		./cmd/$@

# Build local dev servers (native arch, no cross-compile needed)
build-local:
	CGO_ENABLED=0 go build -ldflags="-s -w" -o dist/api-local ./cmd/api-local
	CGO_ENABLED=0 go build -ldflags="-s -w" -o dist/ws-local  ./cmd/ws-local

clean:
	rm -rf dist/

tidy:
	go mod tidy

# ─── API integration tests (requires hurl: brew install hurl) ─────────────────
# Requires the local Docker Compose stack running on :8787
.PHONY: test-api test-api-smoke

test-api-smoke:
	cd tests/api && hurl --test --variables-file vars/local.env smoke.hurl

test-api:
	cd tests/api && hurl --test --variables-file vars/local.env \
		smoke.hurl \
		auth.hurl \
		share-links.hurl \
		collab-scenes.hurl \
		libraries.hurl
