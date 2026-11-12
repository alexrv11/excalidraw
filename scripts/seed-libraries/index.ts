/**
 * Seed script: generates .excalidrawlib files and manifest.json
 * into excalidraw-app/public/libraries/.
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
  createdAt: string;
  updatedAt: string;
  downloads: number;
  libraryUrl: string;
  items: ManifestItem[];
}
interface Manifest {
  version: 1;
  updatedAt: string;
  collections: ManifestCollection[];
}

function run() {
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
      createdAt: today,
      updatedAt: today,
      downloads: 0,
      libraryUrl: `/libraries/${col.id}.excalidrawlib`,
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
  console.log(`\nDone — ${manifestCollections.length} collection(s), ${manifestCollections.reduce((s, c) => s + c.items.length, 0)} icons total.`);
}

run();
