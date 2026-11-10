/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v3 (Ion) — unified infrastructure for the entire Excalidraw monorepo.
 *
 * Resources managed here:
 *   - DynamoDB tables  (Scenes, ShareLinks, Connections)
 *   - S3 bucket        (binary files / images)
 *   - HTTP API         (Go Lambdas — share links, collab scenes, file proxy)
 *   - WebSocket API    (Go Lambdas — real-time collaboration)
 *   - Static site      (Excalidraw frontend → S3 + CloudFront)
 *
 * Before deploying, build the Go binaries:
 *   cd backend && make build && cd ..
 *
 * Then deploy:
 *   yarn sst:deploy          # dev stage
 *   yarn sst:deploy:prod     # production stage
 */
export default $config({
  app(input) {
    return {
      name: "excalidraw",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },

  async run() {
    // ─── DynamoDB Tables ──────────────────────────────────────────────────────

    const scenesTable = new sst.aws.Dynamo("Scenes", {
      fields: { roomId: "string" },
      primaryIndex: { hashKey: "roomId" },
      ttl: "ttl",
    });

    const shareLinksTable = new sst.aws.Dynamo("ShareLinks", {
      fields: { id: "string" },
      primaryIndex: { hashKey: "id" },
      ttl: "ttl",
    });

    // PK: roomId | SK: connectionId
    // GSI byConnection: PK: connectionId  (used by $disconnect)
    const connectionsTable = new sst.aws.Dynamo("Connections", {
      fields: {
        roomId:       "string",
        connectionId: "string",
      },
      primaryIndex: { hashKey: "roomId", rangeKey: "connectionId" },
      globalIndexes: {
        byConnection: { hashKey: "connectionId" },
      },
      ttl: "ttl",
    });

    // ─── S3 Bucket ───────────────────────────────────────────────────────────

    const filesBucket = new sst.aws.Bucket("Files", {
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: ["GET", "PUT"],
          allowedOrigins: ["*"],
          maxAge: "1 day",
        },
      ],
    });

    // ─── Go Lambda helper ─────────────────────────────────────────────────────
    // All binaries are compiled by `cd backend && make build`.
    // Each cmd produces:  backend/dist/<name>/bootstrap

    const goFn = (
      cmd: string,
      env: Record<string, $util.Input<string>>,
    ) => ({
      handler:      "bootstrap",
      runtime:      "provided.al2023" as const,
      architecture: "x86_64" as const,
      bundle:       `backend/dist/${cmd}`,
      environment:  env,
    });

    // Shared env used by WebSocket handlers that touch multiple tables.
    const wsEnv = {
      CONNECTIONS_TABLE: connectionsTable.name,
      SCENES_TABLE:      scenesTable.name,
    };

    // ─── HTTP API ────────────────────────────────────────────────────────────

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowHeaders: ["content-type", "content-length"],
        allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
        allowOrigins: ["*"],
        maxAge: "1 day",
      },
    });

    // Share links — read-only shareable scene links
    api.route("POST /api/v2/post/",
      goFn("sharelinks-post", { SHARE_LINKS_TABLE: shareLinksTable.name }));
    api.route("GET /api/v2/{id}",
      goFn("sharelinks-get", { SHARE_LINKS_TABLE: shareLinksTable.name }));

    // Collab scene persistence — encrypted snapshots for rejoining rooms
    api.route("GET /api/collab/scenes/{roomId}",
      goFn("collabscenes-get", { SCENES_TABLE: scenesTable.name }));
    api.route("PUT /api/collab/scenes/{roomId}",
      goFn("collabscenes-put", { SCENES_TABLE: scenesTable.name }));

    // Binary file storage — images shared inside collab rooms or via share links
    api.route("PUT /files/{key+}",
      goFn("files-put", { FILES_BUCKET: filesBucket.name }));
    api.route("GET /files/{key+}",
      goFn("files-get", { FILES_BUCKET: filesBucket.name }));

    // ─── WebSocket API ───────────────────────────────────────────────────────

    const ws = new sst.aws.ApiGatewayWebSocket("WebSocket", {});

    ws.route("$connect",
      goFn("ws-connect",    { CONNECTIONS_TABLE: connectionsTable.name }));
    ws.route("$disconnect",
      goFn("ws-disconnect", { CONNECTIONS_TABLE: connectionsTable.name }));
    ws.route("join-room",
      goFn("ws-join-room",  { CONNECTIONS_TABLE: connectionsTable.name }));
    ws.route("server-broadcast",
      goFn("ws-broadcast",  wsEnv));
    ws.route("server-volatile-broadcast",
      goFn("ws-volatile",   { CONNECTIONS_TABLE: connectionsTable.name }));
    ws.route("user-follow",
      goFn("ws-user-follow",{ CONNECTIONS_TABLE: connectionsTable.name }));

    // ─── Frontend — Static Site (S3 + CloudFront) ────────────────────────────

    const site = new sst.aws.StaticSite("ExcalidrawApp", {
      // Build runs from the monorepo root so pnpm workspaces are resolved.
      path: ".",
      build: {
        command: "pnpm run build",       // root script: pnpm --dir ./excalidraw-app build
        output:  "excalidraw-app/build",
      },

      // Custom domain — SST provisions an ACM cert and wires CloudFront.
      // ventulab.com must have a hosted zone in Route 53 (or add the CNAME manually).
      domain: {
        name: "excalidraw.ventulab.com",
      },

      // SPA routing: all 404s served as index.html (client-side router).
      errorPage: "index.html",

      // Vite env vars injected at build time — SST outputs are auto-resolved.
      environment: {
        // ── AWS backend URLs (wired from SST outputs) ──────────────────────
        VITE_APP_AWS_API_URL:          api.url,
        VITE_APP_BACKEND_V2_GET_URL:   $interpolate`${api.url}/api/v2/`,
        VITE_APP_BACKEND_V2_POST_URL:  $interpolate`${api.url}/api/v2/post/`,
        VITE_APP_WS_SERVER_URL:        ws.url,

        // ── Static configuration ───────────────────────────────────────────
        VITE_APP_LIBRARY_URL:
          "https://libraries.excalidraw.com",
        VITE_APP_LIBRARY_BACKEND:
          "https://us-central1-excalidraw-room-persistence.cloudfunctions.net/libraries",
        VITE_APP_PLUS_LP:              "https://plus.excalidraw.com",
        VITE_APP_PLUS_APP:             "https://app.excalidraw.com",
        VITE_APP_AI_BACKEND:           "https://oss-ai.excalidraw.com",
        VITE_APP_ENABLE_TRACKING:      "false",
        VITE_APP_COLLAPSE_OVERLAY:     "false",
        VITE_APP_ENABLE_ESLINT:        "false",

        // ── Excalidraw Plus export key ─────────────────────────────────────
        VITE_APP_PLUS_EXPORT_PUBLIC_KEY: [
          "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApQ0jM9Qz8TdFLzcuAZZX",
          "/WvuKSOJxiw6AR/ZcE3eFQWM/mbFdhQgyK8eHGkKQifKzH1xUZjCxyXcxW6ZO02t",
          "kPOPxhz+nxUrIoWCD/V4NGmUA1lxwHuO21HN1gzKrN3xHg5EGjyouR9vibT9VDGF",
          "gq6+4Ic/kJX+AD2MM7Yre2+FsOdysrmuW2Fu3ahuC1uQE7pOe1j0k7auNP0y1q53",
          "PrB8Ts2LUpepWC1l7zIXFm4ViDULuyWXTEpUcHSsEH8vpd1tckjypxCwkipfZsXx",
          "iPszy0o0Dx2iArPfWMXlFAI9mvyFCyFC3+nSvfyAUb2C4uZgCwAuyFh/ydPF4DEE",
          "PQIDAQAB",
        ].join("\n"),
      },
    });

    // ─── Outputs ─────────────────────────────────────────────────────────────

    return {
      siteUrl:     site.url,
      apiUrl:      api.url,
      wsUrl:       ws.url,
      filesBucket: filesBucket.name,
    };
  },
});
