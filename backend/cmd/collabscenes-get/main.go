package main

import (
	"context"
	"encoding/base64"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbTypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/excalidraw/backend/internal/ddb"
	"github.com/excalidraw/backend/internal/response"
)

type sceneItem struct {
	RoomID       string `dynamodbav:"roomId"`
	SceneVersion int64  `dynamodbav:"sceneVersion"`
	Ciphertext   []byte `dynamodbav:"ciphertext"`
	IV           []byte `dynamodbav:"iv"`
}

type sceneResponse struct {
	SceneVersion int64  `json:"sceneVersion"`
	Ciphertext   string `json:"ciphertext"` // base64
	IV           string `json:"iv"`         // base64
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := req.PathParameters["roomId"]
	if roomID == "" {
		return response.Error(400, "missing roomId"), nil
	}

	result, err := ddb.Client().GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(ddb.TableName("SCENES_TABLE")),
		Key: map[string]ddbTypes.AttributeValue{
			"roomId": &ddbTypes.AttributeValueMemberS{Value: roomID},
		},
	})
	if err != nil {
		return response.Error(500, "failed to get item: "+err.Error()), nil
	}
	if result.Item == nil {
		return response.Error(404, "not found"), nil
	}

	var item sceneItem
	if err := attributevalue.UnmarshalMap(result.Item, &item); err != nil {
		return response.Error(500, "unmarshal error"), nil
	}

	return response.JSON(200, sceneResponse{
		SceneVersion: item.SceneVersion,
		Ciphertext:   base64.StdEncoding.EncodeToString(item.Ciphertext),
		IV:           base64.StdEncoding.EncodeToString(item.IV),
	}), nil
}

func main() {
	lambda.Start(handler)
}
