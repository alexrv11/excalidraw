/**
 * AWSSocket — a socket.io-compatible WebSocket wrapper for AWS API Gateway.
 *
 * Mimics the subset of socket.io's Socket API used by Portal.tsx and Collab.tsx:
 *   - on / once / off / emit / close
 *   - socket.id (set from "connection-ack" sent by the $connect Lambda)
 *
 * Wire protocol (all JSON over WebSocket):
 *
 *   Server → Client:
 *     { event: "connection-ack", connectionId: string }
 *     { event: "init-room" }
 *     { event: "first-in-room" }
 *     { event: "new-user", socketId: string }
 *     { event: "room-user-change", clients: string[] }
 *     { event: "client-broadcast", ciphertext: base64, iv: base64 }
 *     { event: "user-follow-room-change", followedBy: string[] }
 *
 *   Client → Server (action routes):
 *     { action: "join-room", roomId: string }
 *     { action: "server-broadcast", roomId, ciphertext: base64, iv: base64, sceneVersion?: number }
 *     { action: "server-volatile-broadcast", roomId, ciphertext: base64, iv: base64 }
 *     { action: "user-follow", payload: { userToFollow, action } }
 */

export interface ISocket {
  id: string;
  on(event: string, cb: (...args: any[]) => void): void;
  once(event: string, cb: (...args: any[]) => void): void;
  off(event: string, cb?: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  close(): void;
}

// WS_EVENTS from app_constants (duplicated here to avoid circular dep)
const SERVER_BROADCAST = "server-broadcast";
const SERVER_VOLATILE = "server-volatile-broadcast";
const USER_FOLLOW = "user-follow";

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(base64ToArrayBuffer(b64)) as Uint8Array<ArrayBuffer>;
}

export class AWSSocket implements ISocket {
  id: string = "";

  private ws: WebSocket;
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  private onceListeners = new Map<string, Set<(...args: any[]) => void>>();
  private closed = false;

  constructor(url: string) {
    // API Gateway WebSocket URLs use wss:// — no extra path needed
    this.ws = new WebSocket(url);

    this.ws.onmessage = (msgEvent) => {
      let msg: Record<string, any>;
      try {
        msg = JSON.parse(msgEvent.data as string);
      } catch {
        return;
      }
      this._dispatch(msg);
    };

    this.ws.onerror = () => {
      if (!this.closed) {
        this._fire("connect_error", new Error("WebSocket connection error"));
      }
    };

    this.ws.onclose = () => {
      if (!this.closed) {
        this._fire("disconnect", "transport close");
      }
    };
  }

  on(event: string, cb: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
  }

  once(event: string, cb: (...args: any[]) => void): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(cb);
  }

  off(event: string, cb?: (...args: any[]) => void): void {
    if (cb === undefined) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.get(event)?.delete(cb);
      this.onceListeners.get(event)?.delete(cb);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (event === SERVER_BROADCAST || event === SERVER_VOLATILE) {
      // args: [roomId: string, encryptedBuffer: ArrayBuffer, iv: Uint8Array]
      const [roomId, encryptedBuffer, iv] = args as [
        string,
        ArrayBuffer,
        Uint8Array,
      ];
      this.ws.send(
        JSON.stringify({
          action: event,
          roomId,
          ciphertext: arrayBufferToBase64(encryptedBuffer),
          iv: arrayBufferToBase64(iv.buffer),
        }),
      );
    } else if (event === "join-room") {
      const [roomId] = args as [string];
      this.ws.send(JSON.stringify({ action: "join-room", roomId }));
    } else if (event === USER_FOLLOW) {
      const [payload] = args;
      this.ws.send(JSON.stringify({ action: "user-follow", payload }));
    }
  }

  close(): void {
    this.closed = true;
    this.ws.close();
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private _dispatch(msg: Record<string, any>): void {
    const { event } = msg;

    if (event === "connection-ack") {
      // Set socket.id then fire the synthetic "init-room" that Portal.tsx
      // listens for to trigger the "join-room" emit.
      this.id = msg.connectionId as string;
      this._fire("init-room");
      return;
    }

    if (event === "client-broadcast") {
      // Deserialize base64 back to binary types expected by Collab.tsx
      const ciphertext = base64ToArrayBuffer(msg.ciphertext as string);
      const iv = base64ToUint8Array(msg.iv as string);
      this._fire("client-broadcast", ciphertext, iv);
      return;
    }

    if (event === "room-user-change") {
      this._fire("room-user-change", msg.clients);
      return;
    }

    if (event === "new-user") {
      this._fire("new-user", msg.socketId);
      return;
    }

    if (event === "first-in-room") {
      this._fire("first-in-room");
      return;
    }

    if (event === "user-follow-room-change") {
      this._fire("user-follow-room-change", msg.followedBy);
      return;
    }
  }

  private _fire(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));

    const onceCbs = this.onceListeners.get(event);
    if (onceCbs) {
      onceCbs.forEach((cb) => cb(...args));
      this.onceListeners.delete(event);
    }
  }
}
