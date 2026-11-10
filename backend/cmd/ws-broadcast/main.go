package main

import (
	"context"
	"encoding/json"
	"time"

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

const sceneTTL = 90 * 24 * 60 * 60 // 90 days

type broadcastMsg struct {
	RoomID       string `json:"roomId"`
	Ciphertext   string `json:"ciphertext"`   // base64-encoded AES ciphertext
	IV           string `json:"iv"`           // base64-encoded AES IV
	SceneVersion *int64 `json:"sceneVersion"` // optional — present on SCENE_INIT / SCENE_UPDATE
}

type connRow struct {
	RoomID       string `dynamodbav:"roomId"`
	ConnectionID string `dynamodbav:"connectionId"`
}

type sceneItem struct {
	RoomID       string `dynamodbav:"roomId"`
	SceneVersion int64  `dynamodbav:"sceneVersion"`
	Ciphertext   string `dynamodbav:"ciphertext"` // stored as plain base64 string
	IV           string `dynamodbav:"iv"`
	UpdatedAt    int64  `dynamodbav:"updatedAt"`
	TTL          int64  `dynamodbav:"ttl"`
}

// server-broadcast — reliable relay (SCENE_INIT, SCENE_UPDATE, etc.)
//
// Client sends: { action: "server-broadcast", roomId, ciphertext, iv, sceneVersion? }
//
//  1. Relays the encrypted payload as "client-broadcast" to all OTHER connections.
//  2. Optionally persists the latest scene snapshot to the Scenes table so
//     new joiners can load state from DynamoDB when no peer is available.
func handler(ctx context.Context, event events.APIGatewayWebsocketProxyRequest) (events.APIGatewayProxyResponse, error) {
	senderID := event.RequestContext.ConnectionID

	var msg broadcastMsg
	if err := json.Unmarshal([]byte(event.Body), &msg); err != nil {
		return response.Text(400, "invalid body"), nil
	}
	if msg.RoomID == "" || msg.Ciphertext == "" || msg.IV == "" {
		return response.Text(400, "missing fields"), nil
	}

	ddbClient := ddb.Client()

	// 1. Get all connections in the room.
	result, err := ddbClient.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(ddb.TableName("CONNECTIONS_TABLE")),
		KeyConditionExpression: aws.String("roomId = :rid"),
		ExpressionAttributeValues: map[string]ddbTypes.AttributeValue{
			":rid": &ddbTypes.AttributeValueMemberS{Value: msg.RoomID},
		},
	})
	if err != nil {
		return response.Text(500, "query error: "+err.Error()), nil
	}

	var conns []connRow
	attributevalue.UnmarshalListOfMaps(result.Items, &conns) //nolint:errcheck

	mgmt, err := apigw.NewClient(ctx, event)
	if err != nil {
		return response.Text(500, "management client error"), nil
	}

	// 2. Relay to all connections except the sender.
	payload := map[string]any{
		"event":      "client-broadcast",
		"ciphertext": msg.Ciphertext,
		"iv":         msg.IV,
	}
	for _, c := range conns {
		if c.ConnectionID == senderID {
			continue
		}
		apigw.Send(ctx, mgmt, c.ConnectionID, payload) //nolint:errcheck
	}

	// 3. Persist the latest encrypted scene snapshot (server never decrypts it).
	if msg.SceneVersion != nil {
		item := sceneItem{
			RoomID:       msg.RoomID,
			SceneVersion: *msg.SceneVersion,
			Ciphertext:   msg.Ciphertext,
			IV:           msg.IV,
			UpdatedAt:    time.Now().UnixMilli(),
			TTL:          time.Now().Unix() + sceneTTL,
		}
		av, err := attributevalue.MarshalMap(item)
		if err == nil {
			ddbClient.PutItem(ctx, &dynamodb.PutItemInput{ //nolint:errcheck
				TableName: aws.String(ddb.TableName("SCENES_TABLE")),
				Item:      av,
			})
		}
	}

	return response.Text(200, "OK"), nil
}

func main() {
	lambda.Start(handler)
}
