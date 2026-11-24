package libraryhandler

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/excalidraw/backend/internal/auth"
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
	token, ok := auth.BearerToken(req)
	if !ok {
		return response.Error(401, "missing authorization"), nil
	}
	claims, err := auth.VerifySessionToken(token)
	if err != nil {
		return response.Error(403, "invalid token: "+err.Error()), nil
	}
	sub := claims.Sub

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
	token, ok := auth.BearerToken(req)
	if !ok {
		return response.Error(401, "missing authorization"), nil
	}
	claims, err := auth.VerifySessionToken(token)
	if err != nil {
		return response.Error(403, "invalid token: "+err.Error()), nil
	}
	sub := claims.Sub

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
	token, ok := auth.BearerToken(req)
	if !ok {
		return response.Error(401, "missing authorization"), nil
	}
	claims, err := auth.VerifySessionToken(token)
	if err != nil {
		return response.Error(403, "invalid token: "+err.Error()), nil
	}
	sub := claims.Sub

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
