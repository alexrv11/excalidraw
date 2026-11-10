package main

import (
	"context"

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

type connRow struct {
	RoomID       string `dynamodbav:"roomId"`
	ConnectionID string `dynamodbav:"connectionId"`
	FollowTarget string `dynamodbav:"followTarget,omitempty"`
}

// $disconnect — fires when a WebSocket client disconnects (normal or abrupt).
//
// Looks up all rooms this connection belongs to via the byConnection GSI,
// removes the connection row, then notifies remaining room members with
// an updated "room-user-change" event.
func handler(ctx context.Context, event events.APIGatewayWebsocketProxyRequest) (events.APIGatewayProxyResponse, error) {
	connectionID := event.RequestContext.ConnectionID
	table := ddb.TableName("CONNECTIONS_TABLE")
	client := ddb.Client()

	// 1. Find which rooms this connection belongs to (GSI: byConnection).
	gsiResult, err := client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(table),
		IndexName:              aws.String("byConnection"),
		KeyConditionExpression: aws.String("connectionId = :cid"),
		ExpressionAttributeValues: map[string]ddbTypes.AttributeValue{
			":cid": &ddbTypes.AttributeValueMemberS{Value: connectionID},
		},
	})
	if err != nil || len(gsiResult.Items) == 0 {
		return response.Text(200, "Disconnected"), nil
	}

	var rows []connRow
	attributevalue.UnmarshalListOfMaps(gsiResult.Items, &rows) //nolint:errcheck

	mgmt, err := apigw.NewClient(ctx, event)
	if err != nil {
		return response.Text(200, "Disconnected"), nil
	}

	for _, row := range rows {
		roomID := row.RoomID

		// 2. Delete this connection from the room.
		client.DeleteItem(ctx, &dynamodb.DeleteItemInput{ //nolint:errcheck
			TableName: aws.String(table),
			Key: map[string]ddbTypes.AttributeValue{
				"roomId":       &ddbTypes.AttributeValueMemberS{Value: roomID},
				"connectionId": &ddbTypes.AttributeValueMemberS{Value: connectionID},
			},
		})

		// 3. Query remaining connections in the room.
		remResult, err := client.Query(ctx, &dynamodb.QueryInput{
			TableName:              aws.String(table),
			KeyConditionExpression: aws.String("roomId = :rid"),
			ExpressionAttributeValues: map[string]ddbTypes.AttributeValue{
				":rid": &ddbTypes.AttributeValueMemberS{Value: roomID},
			},
		})
		if err != nil {
			continue
		}

		var remaining []connRow
		attributevalue.UnmarshalListOfMaps(remResult.Items, &remaining) //nolint:errcheck

		clientIDs := make([]string, 0, len(remaining))
		for _, r := range remaining {
			clientIDs = append(clientIDs, r.ConnectionID)
		}

		// 4. Notify remaining members.
		payload := map[string]any{
			"event":   "room-user-change",
			"clients": clientIDs,
		}
		for _, r := range remaining {
			apigw.Send(ctx, mgmt, r.ConnectionID, payload) //nolint:errcheck
		}
	}

	return response.Text(200, "Disconnected"), nil
}

func main() {
	lambda.Start(handler)
}
