// ws-local: WebSocket server for local development.
//
// Implements the same room protocol as the production Lambda handlers but uses an
// in-memory connection hub instead of API Gateway Management API.  DynamoDB is
// still used to persist scene snapshots (SCENES_TABLE), but active-connection
// tracking is handled entirely in-memory — so CONNECTIONS_TABLE is not required.
//
// Required env vars:
//   AWS_ENDPOINT_URL   — DynamoDB endpoint (e.g. http://dynamodb-local:8000)
//   SCENES_TABLE       — DynamoDB table for scene snapshots (optional; persistence skipped if empty)
//   PORT               — listen port (default 8788)
package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/gorilla/websocket"

	"github.com/excalidraw/backend/internal/ddb"
)

// ─── Hub ─────────────────────────────────────────────────────────────────────

type wsConn struct {
	id   string
	ws   *websocket.Conn
	send chan []byte
}

type hub struct {
	mu      sync.RWMutex
	conns   map[string]*wsConn      // connectionID → conn
	rooms   map[string]map[string]bool // roomID → set of connectionIDs
	follows map[string]string        // followerID → targetID
}

var globalHub = &hub{
	conns:   make(map[string]*wsConn),
	rooms:   make(map[string]map[string]bool),
	follows: make(map[string]string),
}

func (h *hub) register(c *wsConn) {
	h.mu.Lock()
	h.conns[c.id] = c
	h.mu.Unlock()
}

func (h *hub) unregister(c *wsConn) {
	h.mu.Lock()
	delete(h.conns, c.id)
	delete(h.follows, c.id)
	for roomID, members := range h.rooms {
		delete(members, c.id)
		if len(members) == 0 {
			delete(h.rooms, roomID)
		}
	}
	h.mu.Unlock()
}

// joinRoom adds connectionID to the room and returns the existing member IDs
// (snapshot taken before the join).
func (h *hub) joinRoom(roomID, connectionID string) []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[roomID] == nil {
		h.rooms[roomID] = make(map[string]bool)
	}
	existing := make([]string, 0, len(h.rooms[roomID]))
	for id := range h.rooms[roomID] {
		existing = append(existing, id)
	}
	h.rooms[roomID][connectionID] = true
	return existing
}

// leaveRoom removes connectionID from the room and returns remaining member IDs.
func (h *hub) leaveRoom(roomID, connectionID string) []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[roomID] != nil {
		delete(h.rooms[roomID], connectionID)
		if len(h.rooms[roomID]) == 0 {
			delete(h.rooms, roomID)
		}
	}
	remaining := make([]string, 0)
	for id := range h.rooms[roomID] {
		remaining = append(remaining, id)
	}
	return remaining
}

// roomsOf returns all roomIDs that contain connectionID.
func (h *hub) roomsOf(connectionID string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]string, 0)
	for roomID, members := range h.rooms {
		if members[connectionID] {
			out = append(out, roomID)
		}
	}
	return out
}

func (h *hub) setFollow(followerID, targetID string) {
	h.mu.Lock()
	h.follows[followerID] = targetID
	h.mu.Unlock()
}

func (h *hub) clearFollow(followerID string) {
	h.mu.Lock()
	delete(h.follows, followerID)
	h.mu.Unlock()
}

func (h *hub) followersOf(targetID string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]string, 0)
	for follower, target := range h.follows {
		if target == targetID {
			out = append(out, follower)
		}
	}
	return out
}

// send delivers a JSON payload to a specific connection. Returns false if not found.
func (h *hub) send(connectionID string, payload any) bool {
	h.mu.RLock()
	c := h.conns[connectionID]
	h.mu.RUnlock()
	if c == nil {
		return false
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return false
	}
	select {
	case c.send <- data:
		return true
	default:
		return false
	}
}

// broadcast sends payload to all members of a room except senderID.
func (h *hub) broadcast(roomID, senderID string, payload any) {
	h.mu.RLock()
	members := make([]string, 0, len(h.rooms[roomID]))
	for id := range h.rooms[roomID] {
		members = append(members, id)
	}
	h.mu.RUnlock()
	for _, id := range members {
		if id != senderID {
			h.send(id, payload)
		}
	}
}

// ─── DynamoDB scene persistence ───────────────────────────────────────────────

const sceneTTL = 90 * 24 * 60 * 60

type sceneItem struct {
	RoomID       string `dynamodbav:"roomId"`
	SceneVersion int64  `dynamodbav:"sceneVersion"`
	Ciphertext   string `dynamodbav:"ciphertext"`
	IV           string `dynamodbav:"iv"`
	UpdatedAt    int64  `dynamodbav:"updatedAt"`
	TTL          int64  `dynamodbav:"ttl"`
}

func persistScene(ctx context.Context, roomID, ciphertext, iv string, version int64) {
	table := os.Getenv("SCENES_TABLE")
	if table == "" {
		return
	}
	item := sceneItem{
		RoomID:       roomID,
		SceneVersion: version,
		Ciphertext:   ciphertext,
		IV:           iv,
		UpdatedAt:    time.Now().UnixMilli(),
		TTL:          time.Now().Unix() + sceneTTL,
	}
	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return
	}
	ddb.Client().PutItem(ctx, &dynamodb.PutItemInput{ //nolint:errcheck
		TableName: aws.String(table),
		Item:      av,
	})
}

// ─── WebSocket upgrader ───────────────────────────────────────────────────────

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
}

// ─── Incoming message ─────────────────────────────────────────────────────────

type incomingMsg struct {
	Action string `json:"action"`
	RoomID string `json:"roomId"`
	// server-broadcast / server-volatile-broadcast
	Ciphertext   string `json:"ciphertext"`
	IV           string `json:"iv"`
	SceneVersion *int64 `json:"sceneVersion"`
	// user-follow wraps its data in payload
	Payload json.RawMessage `json:"payload"`
}

type followPayload struct {
	UserToFollow struct {
		SocketID string `json:"socketId"`
	} `json:"userToFollow"`
	Action string `json:"action"` // "FOLLOW" | "UNFOLLOW"
}

// ─── WebSocket handler ────────────────────────────────────────────────────────

func serveWS(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade: %v", err)
		return
	}

	raw := make([]byte, 10)
	if _, err := rand.Read(raw); err != nil {
		ws.Close()
		return
	}
	connID := fmt.Sprintf("%x", raw)

	c := &wsConn{id: connID, ws: ws, send: make(chan []byte, 256)}
	globalHub.register(c)

	// Write loop — drain the send channel.
	go func() {
		defer ws.Close()
		for msg := range c.send {
			if err := ws.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		}
	}()

	// Send connection-ack (awsSocket.ts uses this to set socket.id).
	globalHub.send(connID, map[string]any{
		"event":        "connection-ack",
		"connectionId": connID,
	})

	// Read loop.
	for {
		_, msgBytes, err := ws.ReadMessage()
		if err != nil {
			break
		}
		var msg incomingMsg
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			continue
		}
		ctx := r.Context()
		switch msg.Action {
		case "join-room":
			handleJoinRoom(c, msg.RoomID)
		case "server-broadcast":
			handleBroadcast(ctx, c, msg, true)
		case "server-volatile-broadcast":
			handleBroadcast(ctx, c, msg, false)
		case "user-follow":
			handleUserFollow(c, msg)
		}
	}

	// Disconnect: notify remaining room members, then clean up.
	handleDisconnect(c)
	globalHub.unregister(c)
	close(c.send)
}

// ─── Action handlers ──────────────────────────────────────────────────────────

func handleJoinRoom(c *wsConn, roomID string) {
	if roomID == "" {
		return
	}
	existing := globalHub.joinRoom(roomID, c.id)
	allIDs := append(existing, c.id)

	if len(existing) == 0 {
		globalHub.send(c.id, map[string]any{"event": "first-in-room"})
	} else {
		newUser := map[string]any{"event": "new-user", "socketId": c.id}
		for _, id := range existing {
			globalHub.send(id, newUser)
		}
	}

	roomChange := map[string]any{"event": "room-user-change", "clients": allIDs}
	for _, id := range allIDs {
		globalHub.send(id, roomChange)
	}
}

func handleBroadcast(ctx context.Context, c *wsConn, msg incomingMsg, persist bool) {
	if msg.RoomID == "" || msg.Ciphertext == "" || msg.IV == "" {
		return
	}
	globalHub.broadcast(msg.RoomID, c.id, map[string]any{
		"event":      "client-broadcast",
		"ciphertext": msg.Ciphertext,
		"iv":         msg.IV,
	})
	if persist && msg.SceneVersion != nil {
		persistScene(ctx, msg.RoomID, msg.Ciphertext, msg.IV, *msg.SceneVersion)
	}
}

func handleUserFollow(c *wsConn, msg incomingMsg) {
	var fp followPayload
	if len(msg.Payload) == 0 {
		return
	}
	if err := json.Unmarshal(msg.Payload, &fp); err != nil {
		return
	}
	targetID := fp.UserToFollow.SocketID
	action := fp.Action
	if targetID == "" || (action != "FOLLOW" && action != "UNFOLLOW") {
		return
	}

	if action == "FOLLOW" {
		globalHub.setFollow(c.id, targetID)
	} else {
		globalHub.clearFollow(c.id)
	}

	globalHub.send(targetID, map[string]any{
		"event":      "user-follow-room-change",
		"followedBy": globalHub.followersOf(targetID),
	})
}

func handleDisconnect(c *wsConn) {
	for _, roomID := range globalHub.roomsOf(c.id) {
		remaining := globalHub.leaveRoom(roomID, c.id)
		payload := map[string]any{"event": "room-user-change", "clients": remaining}
		for _, id := range remaining {
			globalHub.send(id, payload)
		}
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8788"
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if websocket.IsWebSocketUpgrade(r) {
			serveWS(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ws-local running")) //nolint:errcheck
	})

	log.Printf("ws-local listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
