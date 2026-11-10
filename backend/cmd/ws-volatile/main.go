package main

import (
	"context"
	"encoding/json"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbTypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/excalidraw/backend/internal/apigw"
	"github.com/excalidraw/backend/internal/ddb"
	"github.com/excalidraw/backend/internal/response"
)

type volatileMsg struct {
	RoomID     string `json:"roomId"`
	Ciphertext string `json:"ciphertext"`
	IV         string `json:"iv"`
}

type connRow struct {
	RoomID       string `dynamodbav:"roomId"`
	ConnectionID string `dynamodbav:"connectionId"`
}

// server-volatile-broadcast — ephemeral relay (cursor positions, idle status, viewport bounds).
//
// Identical to server-broadcast but never persists to DynamoDB.
// API GW does not guarantee delivery — dropped messages are acceptable here.
func handler(ctx context.Context, event events.APIGatewayWebsocketProxyRequest) (events.APIGatewayProxyResponse, error) {
	senderID := event.RequestContext.ConnectionID

	var msg volatileMsg
	if err := json.Unmarshal([]byte(event.Body), &msg); err != nil {
		return response.Text(400, "invalid body"), nil
	}
	if msg.RoomID == "" || msg.Ciphertext == "" || msg.IV == "" {
		return response.Text(400, "missing fields"), nil
	}

	result, err := ddb.Client().Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(ddb.TableName("CONNECTIONS_TABLE")),
		KeyConditionExpression: aws.String("roomId = :rid"),
		ExpressionAttributeValues: map[string]ddbTypes.AttributeValue{
			":rid": &ddbTypes.AttributeValueMemberS{Value: msg.RoomID},
		},
	})
	if err != nil {
		return response.Text(500, "query error"), nil
	}

	var conns []connRow
	attributevalue.UnmarshalListOfMaps(result.Items, &conns) //nolint:errcheck

	mgmt, err := apigw.NewClient(ctx, event)
	if err != nil {
		return response.Text(500, "management client error"), nil
	}

	payload := map[string]any{
		"event":      "client-broadcast",
		"ciphertext": msg.Ciphertext,
		"iv":         msg.IV,
	}
	for _, c := range conns {
		if c.ConnectionID != senderID {
			apigw.Send(ctx, mgmt, c.ConnectionID, payload) //nolint:errcheck
		}
	}

	return response.Text(200, "OK"), nil
}

func main() {
	lambda.Start(handler)
}
