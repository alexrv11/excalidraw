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

// 24-hour safety TTL so stale rows auto-expire if $disconnect never fires.
const connTTL = 24 * 60 * 60

type joinMsg struct {
	RoomID string `json:"roomId"`
}

type connRow struct {
	RoomID       string `dynamodbav:"roomId"`
	ConnectionID string `dynamodbav:"connectionId"`
	CreatedAt    int64  `dynamodbav:"createdAt"`
	TTL          int64  `dynamodbav:"ttl"`
}

// join-room — client sends { action: "join-room", roomId: string }.
//
// Flow:
//  1. Query existing connections in the room (before adding the new one).
//  2. Write the new connection row to DynamoDB.
//  3. If first in room → send "first-in-room" to the new client.
//     Otherwise       → send "new-user" to existing members (they broadcast SCENE_INIT back).
//  4. Send updated "room-user-change" to everyone (including the new client).
func handler(ctx context.Context, event events.APIGatewayWebsocketProxyRequest) (events.APIGatewayProxyResponse, error) {
	connectionID := event.RequestContext.ConnectionID
	table := ddb.TableName("CONNECTIONS_TABLE")
	client := ddb.Client()

	var msg joinMsg
	if err := json.Unmarshal([]byte(event.Body), &msg); err != nil || msg.RoomID == "" {
		return response.Text(400, "invalid body"), nil
	}
	roomID := msg.RoomID

	// 1. Query existing connections in the room.
	existResult, err := client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(table),
		KeyConditionExpression: aws.String("roomId = :rid"),
		ExpressionAttributeValues: map[string]ddbTypes.AttributeValue{
			":rid": &ddbTypes.AttributeValueMemberS{Value: roomID},
		},
	})
	if err != nil {
		return response.Text(500, "failed to query room: "+err.Error()), nil
	}

	var existing []connRow
	attributevalue.UnmarshalListOfMaps(existResult.Items, &existing) //nolint:errcheck

	// 2. Write new connection row.
	row := connRow{
		RoomID:       roomID,
		ConnectionID: connectionID,
		CreatedAt:    time.Now().UnixMilli(),
		TTL:          time.Now().Unix() + connTTL,
	}
	av, _ := attributevalue.MarshalMap(row)
	client.PutItem(ctx, &dynamodb.PutItemInput{ //nolint:errcheck
		TableName: aws.String(table),
		Item:      av,
	})

	mgmt, err := apigw.NewClient(ctx, event)
	if err != nil {
		return response.Text(500, "management client error"), nil
	}

	// Build the full client list (existing + new).
	allIDs := make([]string, 0, len(existing)+1)
	for _, e := range existing {
		allIDs = append(allIDs, e.ConnectionID)
	}
	allIDs = append(allIDs, connectionID)

	// 3. Notify based on whether this is the first user.
	if len(existing) == 0 {
		apigw.Send(ctx, mgmt, connectionID, map[string]any{"event": "first-in-room"}) //nolint:errcheck
	} else {
		// Tell existing members a new user has joined (they will broadcast SCENE_INIT).
		newUserMsg := map[string]any{"event": "new-user", "socketId": connectionID}
		for _, e := range existing {
			apigw.Send(ctx, mgmt, e.ConnectionID, newUserMsg) //nolint:errcheck
		}
	}

	// 4. Send updated user list to everyone in the room.
	roomChangeMsg := map[string]any{"event": "room-user-change", "clients": allIDs}
	for _, id := range allIDs {
		apigw.Send(ctx, mgmt, id, roomChangeMsg) //nolint:errcheck
	}

	return response.Text(200, "OK"), nil
}

func main() {
	lambda.Start(handler)
}
