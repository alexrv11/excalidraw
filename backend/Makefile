HTTP_CMDS := sharelinks-post sharelinks-get collabscenes-get collabscenes-put files-put files-get libraries
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
