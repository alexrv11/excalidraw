package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/excalidraw/backend/internal/ddb"
	"github.com/excalidraw/backend/internal/response"
)

// 30 days TTL for share links.
const ttlSeconds = 30 * 24 * 60 * 60

type shareLinkItem struct {
	ID        string `dynamodbav:"id"`
	Data      []byte `dynamodbav:"data"`
	CreatedAt int64  `dynamodbav:"createdAt"`
	TTL       int64  `dynamodbav:"ttl"`
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if req.Body == "" {
		return response.Error(400, "empty body"), nil
	}

	var data []byte
	if req.IsBase64Encoded {
		decoded, err := base64.StdEncoding.DecodeString(req.Body)
		if err != nil {
			return response.Error(400, "invalid base64 body"), nil
		}
		data = decoded
	} else {
		data = []byte(req.Body)
	}

	// Generate a random 16-byte hex ID.
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return response.Error(500, "failed to generate id"), nil
	}
	id := hex.EncodeToString(raw)

	record := shareLinkItem{
		ID:        id,
		Data:      data,
		CreatedAt: time.Now().UnixMilli(),
		TTL:       time.Now().Unix() + ttlSeconds,
	}

	av, err := attributevalue.MarshalMap(record)
	if err != nil {
		return response.Error(500, "marshal error"), nil
	}

	_, err = ddb.Client().PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(ddb.TableName("SHARE_LINKS_TABLE")),
		Item:      av,
	})
	if err != nil {
		return response.Error(500, "failed to save: "+err.Error()), nil
	}

	return response.JSON(200, map[string]string{"id": id}), nil
}

func main() {
	lambda.Start(handler)
}
