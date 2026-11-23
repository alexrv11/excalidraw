/**
 * Seed script: generates .excalidrawlib files and manifest.json
 * into excalidraw-app/public/libraries/.
 *
 * Also upserts DynamoDB records when LIBRARIES_TABLE env var is set
 * (uses full CloudFront URLs built from CDN_BASE env var or a default).
 *
 * Usage:
 *   pnpm seed:libraries
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { buildLibraryFile, type CollectionDef } from "./lib-format.js";
import { designSystemArchitecture } from "./collections/design-system-architecture.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, "../../excalidraw-app/public/libraries");

interface ManifestItem {
  id: string;
  name: string;
  previewUrl: string;
}
interface ManifestCollection {
  id: string;
  title: string;
  description: string;
  author: string;
  authorUrl: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  downloads: number;
  libraryUrl: string;
  itemCount: number;
  items: ManifestItem[];
}
interface Manifest {
  version: 1;
  updatedAt: string;
  collections: ManifestCollection[];
}

const CDN_BASE =
  process.env.CDN_BASE?.replace(/\/$/, "") ?? "https://excalidraw.ventulab.com";

async function run() {
  const collections: CollectionDef[] = [designSystemArchitecture];
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const manifestCollections: ManifestCollection[] = [];

  for (const col of collections) {
    // 1. Write .excalidrawlib
    const libData = buildLibraryFile(col);
    const libPath = path.join(OUTPUT, `${col.id}.excalidrawlib`);
    fs.mkdirSync(OUTPUT, { recursive: true });
    fs.writeFileSync(libPath, JSON.stringify(libData, null, 2));
    console.log(`✓ ${libPath}`);

    // 2. Write SVG preview files
    const previewDir = path.join(OUTPUT, "previews", col.id);
    fs.mkdirSync(previewDir, { recursive: true });

    const items: ManifestItem[] = col.icons.map((icon) => {
      const svgPath = path.join(previewDir, `${icon.id}.svg`);
      fs.writeFileSync(svgPath, icon.svgPreview);
      return {
        id: icon.id,
        name: icon.name,
        previewUrl: `/libraries/previews/${col.id}/${icon.id}.svg`,
      };
    });
    console.log(`  ↳ ${items.length} previews → ${previewDir}`);

    manifestCollections.push({
      id: col.id,
      title: col.title,
      description: col.description,
      author: col.author,
      authorUrl: col.authorUrl,
      tags: col.tags ?? [],
      createdAt: today,
      updatedAt: today,
      downloads: 0,
      libraryUrl: `/libraries/${col.id}.excalidrawlib`,
      itemCount: col.icons.length,
      items,
    });
  }

  // 3. Write manifest.json
  const manifest: Manifest = {
    version: 1,
    updatedAt: now,
    collections: manifestCollections,
  };
  const manifestPath = path.join(OUTPUT, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✓ ${manifestPath}`);

  // 4. Upsert DynamoDB records (only when LIBRARIES_TABLE is set)
  const tableName = process.env.LIBRARIES_TABLE;
  if (tableName) {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, PutCommand } = await import(
      "@aws-sdk/lib-dynamodb"
    );
    const ddbClient = new DynamoDBClient({});
    const ddb = DynamoDBDocumentClient.from(ddbClient);

    for (const col of manifestCollections) {
      const record = {
        ...col,
        // Override URLs to full CloudFront paths for the API
        libraryUrl: `${CDN_BASE}/libraries/${col.id}.excalidrawlib`,
        items: col.items.map((item) => ({
          ...item,
          previewUrl: `${CDN_BASE}/libraries/previews/${col.id}/${item.id}.svg`,
        })),
      };
      await ddb.send(new PutCommand({ TableName: tableName, Item: record }));
      console.log(`  ↳ DynamoDB upsert → ${tableName}/${col.id}`);
    }
  }

  console.log(
    `\nDone — ${manifestCollections.length} collection(s), ${manifestCollections.reduce((s, c) => s + c.items.length, 0)} icons total.`,
  );
}

run();
