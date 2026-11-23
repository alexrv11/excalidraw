package libraryhandler

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/excalidraw/backend/internal/ddb"
	"github.com/excalidraw/backend/internal/response"
)

// ─── Data types ───────────────────────────────────────────────────────────────

type Item struct {
	ID         string `json:"id" dynamodbav:"id"`
	Name       string `json:"name" dynamodbav:"name"`
	PreviewURL string `json:"previewUrl" dynamodbav:"previewUrl"`
}

type Collection struct {
	ID          string   `json:"id" dynamodbav:"id"`
	Title       string   `json:"title" dynamodbav:"title"`
	Description string   `json:"description" dynamodbav:"description"`
	Author      string   `json:"author" dynamodbav:"author"`
	AuthorURL   string   `json:"authorUrl" dynamodbav:"authorUrl"`
	Tags        []string `json:"tags" dynamodbav:"tags"`
	Downloads   int64    `json:"downloads" dynamodbav:"downloads"`
	LibraryURL  string   `json:"libraryUrl" dynamodbav:"libraryUrl"`
	CreatedAt   string   `json:"createdAt" dynamodbav:"createdAt"`
	UpdatedAt   string   `json:"updatedAt" dynamodbav:"updatedAt"`
	ItemCount   int      `json:"itemCount" dynamodbav:"itemCount"`
	Items       []Item   `json:"items,omitempty" dynamodbav:"items"`
}

// ─── JWKS / JWT ───────────────────────────────────────────────────────────────

type jwkSet struct {
	Keys []struct {
		Kid string `json:"kid"`
		Kty string `json:"kty"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

var (
	jwksMu        sync.RWMutex
	jwksKeys      map[string]*rsa.PublicKey
	jwksFetchedAt time.Time
)

const jwksTTL = time.Hour

func getPublicKey(kid string) (*rsa.PublicKey, error) {
	jwksMu.RLock()
	if jwksKeys != nil && time.Since(jwksFetchedAt) < jwksTTL {
		key := jwksKeys[kid]
		jwksMu.RUnlock()
		if key != nil {
			return key, nil
		}
	} else {
		jwksMu.RUnlock()
	}

	jwksMu.Lock()
	defer jwksMu.Unlock()

	domain := os.Getenv("AUTH0_DOMAIN")
	resp, err := http.Get("https://" + domain + "/.well-known/jwks.json") //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("fetch jwks: %w", err)
	}
	defer resp.Body.Close()

	var set jwkSet
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return nil, fmt.Errorf("decode jwks: %w", err)
	}

	m := make(map[string]*rsa.PublicKey)
	for _, k := range set.Keys {
		if k.Kty != "RSA" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		e := 0
		for _, b := range eBytes {
			e = e<<8 | int(b)
		}
		m[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: e}
	}
	jwksKeys = m
	jwksFetchedAt = time.Now()

	if key := m[kid]; key != nil {
		return key, nil
	}
	return nil, fmt.Errorf("kid %q not found in jwks", kid)
}

// verifyJWT validates an Auth0 RS256 JWT and returns the sub claim.
func verifyJWT(tokenStr string) (string, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid jwt format")
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", fmt.Errorf("decode header: %w", err)
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return "", fmt.Errorf("parse header: %w", err)
	}
	if header.Alg != "RS256" {
		return "", fmt.Errorf("unsupported alg: %s", header.Alg)
	}

	pubKey, err := getPublicKey(header.Kid)
	if err != nil {
		return "", err
	}

	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return "", fmt.Errorf("decode signature: %w", err)
	}
	h := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, h[:], sigBytes); err != nil {
		return "", fmt.Errorf("invalid signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("decode payload: %w", err)
	}
	var claims struct {
		Sub string  `json:"sub"`
		Exp float64 `json:"exp"`
	}
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return "", fmt.Errorf("parse claims: %w", err)
	}
	if time.Now().Unix() > int64(claims.Exp) {
		return "", fmt.Errorf("token expired")
	}
	return claims.Sub, nil
}

// bearerToken extracts the Bearer token from the Authorization header.
// HTTP API v2.0 normalises headers to lowercase.
func bearerToken(req events.APIGatewayV2HTTPRequest) (string, bool) {
	auth := req.Headers["authorization"]
	return strings.CutPrefix(auth, "Bearer ")
}

// ─── Table names ──────────────────────────────────────────────────────────────

var (
	LibrariesTable     string
	UserLibrariesTable string
)

func init() {
	LibrariesTable = ddb.TableName("LIBRARIES_TABLE")
	UserLibrariesTable = ddb.TableName("USER_LIBRARIES_TABLE")
}

// ─── Route handlers ───────────────────────────────────────────────────────────

// GET /libraries
func handleList(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	q := strings.ToLower(req.QueryStringParameters["q"])
	tag := req.QueryStringParameters["tag"]

	// Scan all collections (dataset is small; filter in-memory for case-insensitive search).
	result, err := ddb.Client().Scan(ctx, &dynamodb.ScanInput{
		TableName: aws.String(LibrariesTable),
	})
	if err != nil {
		return response.Error(500, "scan failed: "+err.Error()), nil
	}

	var cols []Collection
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &cols); err != nil {
		return response.Error(500, "unmarshal failed: "+err.Error()), nil
	}

	// Strip items array — list responses return metadata only.
	for i := range cols {
		cols[i].Items = nil
	}

	// Filter
	if q != "" {
		var filtered []Collection
		for _, col := range cols {
			if strings.Contains(strings.ToLower(col.Title), q) ||
				strings.Contains(strings.ToLower(col.Description), q) ||
				strings.Contains(strings.ToLower(col.Author), q) {
				filtered = append(filtered, col)
			}
		}
		cols = filtered
	}
	if tag != "" {
		var filtered []Collection
		for _, col := range cols {
			for _, t := range col.Tags {
				if t == tag {
					filtered = append(filtered, col)
					break
				}
			}
		}
		cols = filtered
	}

	sort.Slice(cols, func(i, j int) bool { return cols[i].Downloads > cols[j].Downloads })

	if cols == nil {
		cols = []Collection{}
	}
	return response.JSON(200, map[string]any{"collections": cols}), nil
}

// GET /libraries/:id
func handleGetOne(ctx context.Context, id string) (events.APIGatewayProxyResponse, error) {
	result, err := ddb.Client().GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(LibrariesTable),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: id},
		},
	})
	if err != nil {
		return response.Error(500, "get failed: "+err.Error()), nil
	}
	if result.Item == nil {
		return response.Error(404, "library not found"), nil
	}

	var col Collection
	if err := attributevalue.UnmarshalMap(result.Item, &col); err != nil {
		return response.Error(500, "unmarshal failed: "+err.Error()), nil
	}
	return response.JSON(200, col), nil
}

// POST /libraries/:id/install
func handleInstall(ctx context.Context, req events.APIGatewayV2HTTPRequest, id string) (events.APIGatewayProxyResponse, error) {
	token, ok := bearerToken(req)
	if !ok {
		return response.Error(401, "missing authorization"), nil
	}
	sub, err := verifyJWT(token)
	if err != nil {
		return response.Error(403, "invalid token: "+err.Error()), nil
	}

	// Verify collection exists.
	got, err := ddb.Client().GetItem(ctx, &dynamodb.GetItemInput{
		TableName:            aws.String(LibrariesTable),
		Key:                  map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: id}},
		ProjectionExpression: aws.String("id"),
	})
	if err != nil || got.Item == nil {
		return response.Error(404, "library not found"), nil
	}

	// Atomically increment download counter.
	_, err = ddb.Client().UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:        aws.String(LibrariesTable),
		Key:              map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: id}},
		UpdateExpression: aws.String("SET downloads = if_not_exists(downloads, :zero) + :one"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":one":  &types.AttributeValueMemberN{Value: "1"},
			":zero": &types.AttributeValueMemberN{Value: "0"},
		},
	})
	if err != nil {
		return response.Error(500, "update failed: "+err.Error()), nil
	}

	// Record the install for this user (idempotent — overwrites on re-install).
	_, err = ddb.Client().PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(UserLibrariesTable),
		Item: map[string]types.AttributeValue{
			"userSub":      &types.AttributeValueMemberS{Value: sub},
			"collectionId": &types.AttributeValueMemberS{Value: id},
			"installedAt":  &types.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
		},
	})
	if err != nil {
		return response.Error(500, "record install failed: "+err.Error()), nil
	}

	return response.JSON(200, map[string]bool{"ok": true}), nil
}

// DELETE /libraries/:id/install
func handleUninstall(ctx context.Context, req events.APIGatewayV2HTTPRequest, id string) (events.APIGatewayProxyResponse, error) {
	token, ok := bearerToken(req)
	if !ok {
		return response.Error(401, "missing authorization"), nil
	}
	sub, err := verifyJWT(token)
	if err != nil {
		return response.Error(403, "invalid token: "+err.Error()), nil
	}

	_, err = ddb.Client().DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(UserLibrariesTable),
		Key: map[string]types.AttributeValue{
			"userSub":      &types.AttributeValueMemberS{Value: sub},
			"collectionId": &types.AttributeValueMemberS{Value: id},
		},
	})
	if err != nil {
		return response.Error(500, "delete failed: "+err.Error()), nil
	}

	return response.JSON(200, map[string]bool{"ok": true}), nil
}

// GET /libraries/me
func handleGetMe(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	token, ok := bearerToken(req)
	if !ok {
		return response.Error(401, "missing authorization"), nil
	}
	sub, err := verifyJWT(token)
	if err != nil {
		return response.Error(403, "invalid token: "+err.Error()), nil
	}

	qResult, err := ddb.Client().Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(UserLibrariesTable),
		KeyConditionExpression: aws.String("userSub = :sub"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":sub": &types.AttributeValueMemberS{Value: sub},
		},
	})
	if err != nil {
		return response.Error(500, "query failed: "+err.Error()), nil
	}
	if len(qResult.Items) == 0 {
		return response.JSON(200, map[string]any{"collections": []any{}}), nil
	}

	var installs []struct {
		CollectionID string `dynamodbav:"collectionId"`
	}
	if err := attributevalue.UnmarshalListOfMaps(qResult.Items, &installs); err != nil {
		return response.Error(500, "unmarshal failed: "+err.Error()), nil
	}

	keys := make([]map[string]types.AttributeValue, 0, len(installs))
	for _, r := range installs {
		keys = append(keys, map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: r.CollectionID},
		})
	}

	batchResult, err := ddb.Client().BatchGetItem(ctx, &dynamodb.BatchGetItemInput{
		RequestItems: map[string]types.KeysAndAttributes{
			LibrariesTable: {Keys: keys},
		},
	})
	if err != nil {
		return response.Error(500, "batch get failed: "+err.Error()), nil
	}

	var cols []Collection
	if items, ok := batchResult.Responses[LibrariesTable]; ok {
		if err := attributevalue.UnmarshalListOfMaps(items, &cols); err != nil {
			return response.Error(500, "unmarshal failed: "+err.Error()), nil
		}
	}
	if cols == nil {
		cols = []Collection{}
	}
	return response.JSON(200, map[string]any{"collections": cols}), nil
}

// ─── Main handler ─────────────────────────────────────────────────────────────

// Handler is the Lambda (and local HTTP) entry point.
func Handler(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	method := req.RequestContext.HTTP.Method

	// proxy = "" for GET /libraries; "me", ":id", or ":id/install" for the {proxy+} route
	proxy := req.PathParameters["proxy"]
	segments := strings.SplitN(proxy, "/", 3)

	id := ""
	action := ""
	if len(segments) > 0 && segments[0] != "" {
		id = segments[0]
	}
	if len(segments) > 1 && segments[1] != "" {
		action = segments[1]
	}

	switch {
	case method == "GET" && id == "":
		return handleList(ctx, req)
	case method == "GET" && id == "me" && action == "":
		return handleGetMe(ctx, req)
	case method == "GET" && id != "" && action == "":
		return handleGetOne(ctx, id)
	case method == "POST" && id != "" && action == "install":
		return handleInstall(ctx, req, id)
	case method == "DELETE" && id != "" && action == "install":
		return handleUninstall(ctx, req, id)
	default:
		return response.Error(404, "not found"), nil
	}
}
