/**
 * aws.ts — replaces firebase.ts
 *
 * Provides the same function signatures as firebase.ts so that Collab.tsx
 * and data/index.ts can swap imports with minimal changes.
 *
 * Storage layout (all behind VITE_APP_AWS_API_URL):
 *   Scene blobs (share links)   → POST/GET /api/v2/post / /api/v2/{id}
 *   Collab scene persistence    → GET/PUT /api/collab/scenes/{roomId}
 *   Binary files                → GET/PUT /files/{prefix}/{fileId}
 */

import { MIME_TYPES } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";
import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { ISocket } from "./awsSocket";

// ─── Config ──────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_APP_AWS_API_URL ?? "";

// ─── Scene version cache (mirrors FirebaseSceneVersionCache) ─────────────────

class AWSSceneVersionCache {
  private static cache = new WeakMap<object, number>();

  static get(socket: ISocket): number | undefined {
    return AWSSceneVersionCache.cache.get(socket);
  }

  static set(
    socket: ISocket,
    elements: readonly SyncableExcalidrawElement[],
  ): void {
    AWSSceneVersionCache.cache.set(socket, getSceneVersion(elements));
  }
}

// ─── Encryption helpers ───────────────────────────────────────────────────────

async function encryptElements(
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);
  return { ciphertext: encryptedBuffer, iv };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

// ─── Collab scene persistence (replaces Firestore scenes collection) ──────────

export const isSavedToAWS = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);
    return AWSSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  return true;
};

export const saveToAWS = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
): Promise<readonly RemoteExcalidrawElement[] | null> => {
  const { roomId, roomKey, socket } = portal;
  if (!roomId || !roomKey || !socket || isSavedToAWS(portal, elements)) {
    return null;
  }

  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);

  const response = await fetch(`${API_URL}/api/collab/scenes/${roomId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sceneVersion,
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save scene: ${response.status}`);
  }

  AWSSceneVersionCache.set(socket, elements);

  // Return the elements we stored (no server-side reconciliation — key stays client)
  const { toBrandedType } = await import("@excalidraw/common");
  return toBrandedType<RemoteExcalidrawElement[]>(elements as OrderedExcalidrawElement[]);
};

export const loadFromAWS = async (
  roomId: string,
  roomKey: string,
  socket: ISocket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const response = await fetch(`${API_URL}/api/collab/scenes/${roomId}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load scene: ${response.status}`);
  }

  const data = (await response.json()) as {
    sceneVersion: number;
    ciphertext: string;
    iv: string;
  };

  const iv = base64ToUint8Array(data.iv);
  const ciphertext = base64ToUint8Array(data.ciphertext).buffer as ArrayBuffer;

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decoded = new TextDecoder("utf-8").decode(new Uint8Array(decrypted));
  const rawElements: ExcalidrawElement[] = JSON.parse(decoded);

  const elements = getSyncableElements(
    restoreElements(rawElements, null, { deleteInvisibleElements: true }),
  );

  if (socket) {
    AWSSceneVersionCache.set(socket, elements);
  }

  return elements;
};

// ─── Binary file storage (replaces Firebase Storage) ─────────────────────────

export const saveFilesToAWS = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}): Promise<{ savedFiles: FileId[]; erroredFiles: FileId[] }> => {
  const savedFiles: FileId[] = [];
  const erroredFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const response = await fetch(`${API_URL}/files/${prefix}/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
            "Cache-Control": `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
          },
          body: buffer,
        });
        if (response.ok) {
          savedFiles.push(id);
        } else {
          erroredFiles.push(id);
        }
      } catch {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

export const loadFilesFromAWS = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
): Promise<{ loadedFiles: BinaryFileData[]; erroredFiles: Map<FileId, true> }> => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const response = await fetch(`${API_URL}/files/${prefix}/${id}`);
        if (!response.ok) {
          erroredFiles.set(id, true);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const { data, metadata } = await decompressData<BinaryFileMetadata>(
          new Uint8Array(arrayBuffer),
          { decryptionKey },
        );

        const dataURL = new TextDecoder().decode(data) as DataURL;
        loadedFiles.push({
          mimeType: metadata.mimeType ?? MIME_TYPES.binary,
          id,
          dataURL,
          created: metadata?.created ?? Date.now(),
          lastRetrieved: metadata?.created ?? Date.now(),
        });
      } catch {
        erroredFiles.set(id, true);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};

// ─── Generic byte upload (replaces uploadBytesToFirebase) ────────────────────

export const uploadBytesToAWS = async (
  path: string,
  data: Blob | Uint8Array,
  _metadata?: Record<string, unknown>,
): Promise<void> => {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const body = data instanceof Blob ? await data.arrayBuffer() : data;

  const response = await fetch(`${API_URL}/files/${normalizedPath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body,
  });

  if (!response.ok) {
    throw new Error(`uploadBytesToAWS failed: ${response.status}`);
  }
};

// ─── Re-export with Firebase-compatible names (used by Collab.tsx via alias) ──

export {
  isSavedToAWS as isSavedToFirebase,
  saveToAWS as saveToFirebase,
  loadFromAWS as loadFromFirebase,
  saveFilesToAWS as saveFilesToFirebase,
  loadFilesFromAWS as loadFilesFromFirebase,
  uploadBytesToAWS as uploadBytesToFirebase,
};
