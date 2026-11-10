package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/excalidraw/backend/internal/ddb"
	"github.com/excalidraw/backend/internal/response"
)

// 90-day TTL — rooms with no activity expire automatically.
const ttlSeconds = 90 * 24 * 60 * 60

type putRequest struct {
	SceneVersion int64  `json:"sceneVersion"`
	Ciphertext   string `json:"ciphertext"` // base64
	IV           string `json:"iv"`         // base64
}

type sceneItem struct {
	RoomID       string `dynamodbav:"roomId"`
	SceneVersion int64  `dynamodbav:"sceneVersion"`
	Ciphertext   []byte `dynamodbav:"ciphertext"`
	IV           []byte `dynamodbav:"iv"`
	UpdatedAt    int64  `dynamodbav:"updatedAt"`
	TTL          int64  `dynamodbav:"ttl"`
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := req.PathParameters["roomId"]
	if roomID == "" {
		return response.Error(400, "missing roomId"), nil
	}

	var body putRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response.Error(400, "invalid JSON body"), nil
	}

	ciphertext, err := base64.StdEncoding.DecodeString(body.Ciphertext)
	if err != nil {
		return response.Error(400, "invalid base64 ciphertext"), nil
	}
	iv, err := base64.StdEncoding.DecodeString(body.IV)
	if err != nil {
		return response.Error(400, "invalid base64 iv"), nil
	}

	record := sceneItem{
		RoomID:       roomID,
		SceneVersion: body.SceneVersion,
		Ciphertext:   ciphertext,
		IV:           iv,
		UpdatedAt:    time.Now().UnixMilli(),
		TTL:          time.Now().Unix() + ttlSeconds,
	}

	av, err := attributevalue.MarshalMap(record)
	if err != nil {
		return response.Error(500, "marshal error"), nil
	}

	_, err = ddb.Client().PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(ddb.TableName("SCENES_TABLE")),
		Item:      av,
	})
	if err != nil {
		return response.Error(500, "failed to save: "+err.Error()), nil
	}

	return response.Text(200, "OK"), nil
}

func main() {
	lambda.Start(handler)
}
