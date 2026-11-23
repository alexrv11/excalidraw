// api-local: single HTTP server that covers all HTTP Lambda routes for local development.
//
// Routes mirror sst.config.ts:
//   POST /api/v2/post              — save share link
//   GET  /api/v2/{id}              — get share link
//   GET  /api/collab/scenes/{id}   — get collab scene snapshot
//   PUT  /api/collab/scenes/{id}   — save collab scene snapshot
//   PUT  /files/{key+}             — upload file to S3/MinIO
//   GET  /files/{key+}             — download file from S3/MinIO
//   GET  /libraries                — list libraries
//   ANY  /libraries/{proxy+}       — libraries CRUD
//
// Required env vars:
//   AWS_ENDPOINT_URL       — DynamoDB endpoint (e.g. http://dynamodb-local:8000)
//   SHARE_LINKS_TABLE      — DynamoDB table name
//   SCENES_TABLE           — DynamoDB table name
//   LIBRARIES_TABLE        — DynamoDB table name
//   USER_LIBRARIES_TABLE   — DynamoDB table name
//   FILES_BUCKET           — S3 bucket name
//   S3_ENDPOINT            — S3/MinIO endpoint (e.g. http://minio:9000)
//   AUTH0_DOMAIN           — Auth0 domain (optional; skips JWT verification if empty)
//   PORT                   — listen port (default 8787)
package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbTypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-lambda-go/events"

	"github.com/excalidraw/backend/internal/ddb"
	"github.com/excalidraw/backend/internal/libraryhandler"
)

// ─── S3 client ────────────────────────────────────────────────────────────────

var s3Client *s3.Client

func initS3() {
	endpoint := os.Getenv("S3_ENDPOINT") // e.g. http://minio:9000
	cfg, err := awsconfig.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatalf("load AWS config: %v", err)
	}
	opts := []func(*s3.Options){
		func(o *s3.Options) { o.UsePathStyle = true }, // required for MinIO
	}
	if endpoint != "" {
		opts = append(opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(endpoint)
		})
	}
	s3Client = s3.NewFromConfig(cfg, opts...)
}

// ─── CORS + response helpers ──────────────────────────────────────────────────

func setCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "content-type, content-length, authorization")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	b, _ := json.Marshal(v)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(b) //nolint:errcheck
}

// writeProxyResponse writes an events.APIGatewayProxyResponse to an http.ResponseWriter.
func writeProxyResponse(w http.ResponseWriter, resp events.APIGatewayProxyResponse) {
	for k, v := range resp.Headers {
		w.Header().Set(k, v)
	}
	w.WriteHeader(resp.StatusCode)
	if resp.IsBase64Encoded {
		data, _ := base64.StdEncoding.DecodeString(resp.Body)
		w.Write(data) //nolint:errcheck
	} else {
		io.WriteString(w, resp.Body) //nolint:errcheck
	}
}

// ─── Share links ──────────────────────────────────────────────────────────────

const shareLinkTTL = 30 * 24 * 60 * 60 // 30 days

type shareLinkItem struct {
	ID        string `dynamodbav:"id"`
	Data      []byte `dynamodbav:"data"`
	CreatedAt int64  `dynamodbav:"createdAt"`
	TTL       int64  `dynamodbav:"ttl"`
}

func handleSharePost(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil || len(body) == 0 {
		writeJSON(w, 400, map[string]string{"error": "empty body"})
		return
	}

	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		writeJSON(w, 500, map[string]string{"error": "failed to generate id"})
		return
	}
	id := hex.EncodeToString(raw)

	record := shareLinkItem{
		ID:        id,
		Data:      body,
		CreatedAt: time.Now().UnixMilli(),
		TTL:       time.Now().Unix() + shareLinkTTL,
	}
	av, _ := attributevalue.MarshalMap(record)
	_, err = ddb.Client().PutItem(r.Context(), &dynamodb.PutItemInput{
		TableName: aws.String(os.Getenv("SHARE_LINKS_TABLE")),
		Item:      av,
	})
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "failed to save: " + err.Error()})
		return
	}
	writeJSON(w, 200, map[string]string{"id": id})
}

func handleShareGet(w http.ResponseWriter, r *http.Request) {
	// path: /api/v2/{id}
	id := strings.TrimPrefix(r.URL.Path, "/api/v2/")
	id = strings.TrimSuffix(id, "/")
	if id == "" {
		writeJSON(w, 400, map[string]string{"error": "missing id"})
		return
	}

	result, err := ddb.Client().GetItem(r.Context(), &dynamodb.GetItemInput{
		TableName: aws.String(os.Getenv("SHARE_LINKS_TABLE")),
		Key:       map[string]ddbTypes.AttributeValue{"id": &ddbTypes.AttributeValueMemberS{Value: id}},
	})
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "failed to get item"})
		return
	}
	if result.Item == nil {
		writeJSON(w, 404, map[string]string{"error": "not found"})
		return
	}

	var item shareLinkItem
	attributevalue.UnmarshalMap(result.Item, &item) //nolint:errcheck
	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(200)
	w.Write(item.Data) //nolint:errcheck
}

// ─── Collab scenes ────────────────────────────────────────────────────────────

const sceneTTL = 90 * 24 * 60 * 60

type sceneItem struct {
	RoomID       string `dynamodbav:"roomId"`
	SceneVersion int64  `dynamodbav:"sceneVersion"`
	Ciphertext   []byte `dynamodbav:"ciphertext"`
	IV           []byte `dynamodbav:"iv"`
	UpdatedAt    int64  `dynamodbav:"updatedAt"`
	TTL          int64  `dynamodbav:"ttl"`
}

func handleCollab(w http.ResponseWriter, r *http.Request) {
	// path: /api/collab/scenes/{roomId}
	roomID := strings.TrimPrefix(r.URL.Path, "/api/collab/scenes/")
	roomID = strings.TrimSuffix(roomID, "/")
	if roomID == "" {
		writeJSON(w, 400, map[string]string{"error": "missing roomId"})
		return
	}

	table := os.Getenv("SCENES_TABLE")

	switch r.Method {
	case http.MethodGet:
		result, err := ddb.Client().GetItem(r.Context(), &dynamodb.GetItemInput{
			TableName: aws.String(table),
			Key:       map[string]ddbTypes.AttributeValue{"roomId": &ddbTypes.AttributeValueMemberS{Value: roomID}},
		})
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if result.Item == nil {
			writeJSON(w, 404, map[string]string{"error": "not found"})
			return
		}
		var item sceneItem
		attributevalue.UnmarshalMap(result.Item, &item) //nolint:errcheck
		writeJSON(w, 200, map[string]any{
			"sceneVersion": item.SceneVersion,
			"ciphertext":   base64.StdEncoding.EncodeToString(item.Ciphertext),
			"iv":           base64.StdEncoding.EncodeToString(item.IV),
		})

	case http.MethodPut:
		var body struct {
			SceneVersion int64  `json:"sceneVersion"`
			Ciphertext   string `json:"ciphertext"`
			IV           string `json:"iv"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid JSON"})
			return
		}
		ciphertext, _ := base64.StdEncoding.DecodeString(body.Ciphertext)
		iv, _ := base64.StdEncoding.DecodeString(body.IV)
		record := sceneItem{
			RoomID:       roomID,
			SceneVersion: body.SceneVersion,
			Ciphertext:   ciphertext,
			IV:           iv,
			UpdatedAt:    time.Now().UnixMilli(),
			TTL:          time.Now().Unix() + sceneTTL,
		}
		av, _ := attributevalue.MarshalMap(record)
		_, err := ddb.Client().PutItem(r.Context(), &dynamodb.PutItemInput{
			TableName: aws.String(table),
			Item:      av,
		})
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(200)
		io.WriteString(w, "OK") //nolint:errcheck

	default:
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
	}
}

// ─── File storage (S3 / MinIO) ────────────────────────────────────────────────

func handleFiles(w http.ResponseWriter, r *http.Request) {
	// path: /files/{key+}
	key := strings.TrimPrefix(r.URL.Path, "/files/")
	if key == "" {
		writeJSON(w, 400, map[string]string{"error": "missing key"})
		return
	}

	bucket := os.Getenv("FILES_BUCKET")

	switch r.Method {
	case http.MethodPut:
		body, err := io.ReadAll(r.Body)
		if err != nil || len(body) == 0 {
			writeJSON(w, 400, map[string]string{"error": "empty body"})
			return
		}
		contentType := r.Header.Get("content-type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		_, err = s3Client.PutObject(r.Context(), &s3.PutObjectInput{
			Bucket:       aws.String(bucket),
			Key:          aws.String(key),
			Body:         bytes.NewReader(body),
			ContentType:  aws.String(contentType),
			CacheControl: aws.String("public, max-age=31536000"),
		})
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "upload failed: " + err.Error()})
			return
		}
		w.WriteHeader(200)
		io.WriteString(w, "OK") //nolint:errcheck

	case http.MethodGet:
		result, err := s3Client.GetObject(r.Context(), &s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		})
		if err != nil {
			if strings.Contains(err.Error(), "NoSuchKey") {
				writeJSON(w, 404, map[string]string{"error": "not found"})
			} else {
				writeJSON(w, 500, map[string]string{"error": err.Error()})
			}
			return
		}
		defer result.Body.Close()

		contentType := "application/octet-stream"
		if result.ContentType != nil {
			contentType = *result.ContentType
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "public, max-age=31536000")
		w.WriteHeader(200)
		io.Copy(w, result.Body) //nolint:errcheck

	default:
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
	}
}

// ─── Libraries (via libraryhandler) ──────────────────────────────────────────

func handleLibraries(w http.ResponseWriter, r *http.Request) {
	// Extract proxy segment: everything after /libraries/
	path := strings.TrimPrefix(r.URL.Path, "/libraries")
	proxy := strings.TrimPrefix(path, "/")
	proxy = strings.TrimSuffix(proxy, "/")

	qp := make(map[string]string)
	for k, v := range r.URL.Query() {
		if len(v) > 0 {
			qp[k] = v[0]
		}
	}
	headers := make(map[string]string)
	for k, v := range r.Header {
		if len(v) > 0 {
			headers[strings.ToLower(k)] = v[0]
		}
	}

	body := ""
	if r.Body != nil {
		b, _ := io.ReadAll(r.Body)
		body = string(b)
	}

	req := events.APIGatewayV2HTTPRequest{
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: r.Method,
			},
		},
		PathParameters:        map[string]string{"proxy": proxy},
		QueryStringParameters: qp,
		Headers:               headers,
		Body:                  body,
	}

	resp, err := libraryhandler.Handler(r.Context(), req)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeProxyResponse(w, resp)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	initS3()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		setCORS(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		p := r.URL.Path
		switch {
		case r.Method == http.MethodPost && p == "/api/v2/post":
			handleSharePost(w, r)
		case r.Method == http.MethodGet && strings.HasPrefix(p, "/api/v2/"):
			handleShareGet(w, r)
		case strings.HasPrefix(p, "/api/collab/scenes/"):
			handleCollab(w, r)
		case strings.HasPrefix(p, "/files/"):
			handleFiles(w, r)
		case p == "/libraries" || strings.HasPrefix(p, "/libraries/"):
			handleLibraries(w, r)
		default:
			writeJSON(w, 404, map[string]string{"error": "not found"})
		}
	})

	log.Printf("api-local listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
