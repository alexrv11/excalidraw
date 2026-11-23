/**
 * Local dev setup: creates DynamoDB tables, S3 bucket, and seeds library data.
 * Reads the pre-generated manifest.json produced by `pnpm seed:libraries`.
 *
 * Run inside the `setup` Docker Compose service (Node 20+, ESM).
 * Required env vars:
 *   AWS_ENDPOINT_URL   — DynamoDB endpoint (e.g. http://dynamodb-local:8000)
 *   S3_ENDPOINT        — S3/MinIO endpoint  (e.g. http://minio:9000)
 *   AWS_REGION         — e.g. us-east-1
 *   FILES_BUCKET       — S3 bucket name (default: excalidraw-files)
 *   CDN_BASE           — base URL for library assets (e.g. http://localhost:5173)
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// REPO_ROOT is injected by Docker Compose (repo mounted at /app).
const REPO_ROOT = process.env.REPO_ROOT || join(__dirname, "..");

const ddbEndpoint = process.env.AWS_ENDPOINT_URL || "http://dynamodb-local:8000";
const s3Endpoint  = process.env.S3_ENDPOINT       || "http://minio:9000";
const cdnBase     = (process.env.CDN_BASE ?? "http://localhost:5173").replace(/\/$/, "");
const filesBucket = process.env.FILES_BUCKET || "excalidraw-files";

const rawDdb = new DynamoDBClient({ endpoint: ddbEndpoint });
const ddb    = DynamoDBDocumentClient.from(rawDdb);

const s3 = new S3Client({
  endpoint:        s3Endpoint,
  forcePathStyle:  true,  // required for MinIO
  region:          process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || "minioadmin",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "minioadmin",
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitFor(name, fn, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fn();
      console.log(`${name} is ready.`);
      return;
    } catch {
      console.log(`Waiting for ${name}... (${i + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`${name} did not become ready in time`);
}

async function createDdbTable(input) {
  try {
    await rawDdb.send(new CreateTableCommand(input));
    console.log(`Created DynamoDB table: ${input.TableName}`);
  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log(`DynamoDB table already exists: ${input.TableName}`);
    } else {
      throw err;
    }
  }
}

async function ensureS3Bucket(bucket) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`S3 bucket already exists: ${bucket}`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Created S3 bucket: ${bucket}`);
  }
}

// ── Wait for services ─────────────────────────────────────────────────────────

await waitFor("DynamoDB", () => rawDdb.send(new ListTablesCommand({})));
await waitFor("MinIO/S3", () => s3.send(new HeadBucketCommand({ Bucket: "probe" })).catch((e) => {
  // MinIO returns 404 (NoSuchBucket) when it's up — any response means it's ready.
  if (e.name === "NoSuchBucket" || e.$metadata?.httpStatusCode === 404) return;
  throw e;
}));

// ── DynamoDB tables ───────────────────────────────────────────────────────────

await createDdbTable({
  TableName: "Scenes",
  AttributeDefinitions: [{ AttributeName: "roomId", AttributeType: "S" }],
  KeySchema: [{ AttributeName: "roomId", KeyType: "HASH" }],
  BillingMode: "PAY_PER_REQUEST",
});

await createDdbTable({
  TableName: "ShareLinks",
  AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  BillingMode: "PAY_PER_REQUEST",
});

await createDdbTable({
  TableName: "Connections",
  AttributeDefinitions: [
    { AttributeName: "roomId",       AttributeType: "S" },
    { AttributeName: "connectionId", AttributeType: "S" },
  ],
  KeySchema: [
    { AttributeName: "roomId",       KeyType: "HASH" },
    { AttributeName: "connectionId", KeyType: "RANGE" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "byConnection",
      KeySchema: [{ AttributeName: "connectionId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
});

await createDdbTable({
  TableName: "Libraries",
  AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  BillingMode: "PAY_PER_REQUEST",
});

await createDdbTable({
  TableName: "UserLibraries",
  AttributeDefinitions: [
    { AttributeName: "userSub",       AttributeType: "S" },
    { AttributeName: "collectionId",  AttributeType: "S" },
  ],
  KeySchema: [
    { AttributeName: "userSub",      KeyType: "HASH" },
    { AttributeName: "collectionId", KeyType: "RANGE" },
  ],
  BillingMode: "PAY_PER_REQUEST",
});

// ── S3 bucket ─────────────────────────────────────────────────────────────────

await ensureS3Bucket(filesBucket);

// ── Seed libraries from manifest.json ────────────────────────────────────────

const manifestPath = join(REPO_ROOT, "excalidraw-app/public/libraries/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

for (const col of manifest.collections) {
  const record = {
    ...col,
    libraryUrl: col.libraryUrl.startsWith("http")
      ? col.libraryUrl
      : `${cdnBase}${col.libraryUrl}`,
    items: (col.items ?? []).map((item) => ({
      ...item,
      previewUrl: item.previewUrl.startsWith("http")
        ? item.previewUrl
        : `${cdnBase}${item.previewUrl}`,
    })),
  };
  await ddb.send(new PutCommand({ TableName: "Libraries", Item: record }));
  console.log(`Seeded → Libraries/${col.id}`);
}

console.log(`\nSetup complete — ${manifest.collections.length} collection(s) seeded.`);
