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

const connTTL = 24 * 60 * 60 // 24 hours

type userToFollow struct {
	SocketID string `json:"socketId"`
}

type followPayload struct {
	UserToFollow userToFollow `json:"userToFollow"`
	Action       string       `json:"action"` // "FOLLOW" | "UNFOLLOW"
}

type userFollowMsg struct {
	Payload followPayload `json:"payload"`
}

type connRow struct {
	RoomID       string `dynamodbav:"roomId"`
	ConnectionID string `dynamodbav:"connectionId"`
	FollowTarget string `dynamodbav:"followTarget,omitempty"`
	CreatedAt    int64  `dynamodbav:"createdAt"`
	TTL          int64  `dynamodbav:"ttl"`
}

// user-follow — client sends follow/unfollow requests.
//
// Client: { action: "user-follow", payload: { userToFollow: { socketId }, action: "FOLLOW"|"UNFOLLOW" } }
//
// Steps:
//  1. Find this connection's room (via byConnection GSI).
//  2. Update (or clear) the followTarget on the sender's row.
//  3. Query all room connections to build the followedBy list for the target.
//  4. Send "user-follow-room-change" to the target connection.
func handler(ctx context.Context, event events.APIGatewayWebsocketProxyRequest) (events.APIGatewayProxyResponse, error) {
	senderID := event.RequestContext.ConnectionID
	table := ddb.TableName("CONNECTIONS_TABLE")
	client := ddb.Client()

	var msg userFollowMsg
	if err := json.Unmarshal([]byte(event.Body), &msg); err != nil {
		return response.Text(400, "invalid body"), nil
	}
	targetID := msg.Payload.UserToFollow.SocketID
	action := msg.Payload.Action
	if targetID == "" || (action != "FOLLOW" && action != "UNFOLLOW") {
		return response.Text(400, "invalid payload"), nil
	}

	// 1. Find this connection's room (GSI: byConnection).
	gsiResult, err := client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(table),
		IndexName:              aws.String("byConnection"),
		KeyConditionExpression: aws.String("connectionId = :cid"),
		ExpressionAttributeValues: map[string]ddbTypes.AttributeValue{
			":cid": &ddbTypes.AttributeValueMemberS{Value: senderID},
		},
	})
	if err != nil || len(gsiResult.Items) == 0 {
		return response.Text(400, "connection not in any room"), nil
	}

	var senderRow connRow
	attributevalue.UnmarshalMap(gsiResult.Items[0], &senderRow) //nolint:errcheck
	roomID := senderRow.RoomID

	// 2. Update the sender's followTarget (clear it on UNFOLLOW).
	followTarget := ""
	if action == "FOLLOW" {
		followTarget = targetID
	}

	updated := connRow{
		RoomID:       roomID,
		ConnectionID: senderID,
		FollowTarget: followTarget,
		CreatedAt:    senderRow.CreatedAt,
		TTL:          time.Now().Unix() + connTTL,
	}
	av, _ := attributevalue.MarshalMap(updated)
	client.PutItem(ctx, &dynamodb.PutItemInput{ //nolint:errcheck
		TableName: aws.String(table),
		Item:      av,
	})

	// 3. Query the full room to find everyone following the target.
	roomResult, err := client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(table),
		KeyConditionExpression: aws.String("roomId = :rid"),
		ExpressionAttributeValues: map[string]ddbTypes.AttributeValue{
			":rid": &ddbTypes.AttributeValueMemberS{Value: roomID},
		},
	})
	if err != nil {
		return response.Text(500, "failed to query room"), nil
	}

	var allConns []connRow
	attributevalue.UnmarshalListOfMaps(roomResult.Items, &allConns) //nolint:errcheck

	followedBy := make([]string, 0)
	for _, c := range allConns {
		if c.FollowTarget == targetID {
			followedBy = append(followedBy, c.ConnectionID)
		}
	}

	// 4. Send "user-follow-room-change" to the target.
	mgmt, err := apigw.NewClient(ctx, event)
	if err != nil {
		return response.Text(500, "management client error"), nil
	}
	apigw.Send(ctx, mgmt, targetID, map[string]any{ //nolint:errcheck
		"event":      "user-follow-room-change",
		"followedBy": followedBy,
	})

	return response.Text(200, "OK"), nil
}

func main() {
	lambda.Start(handler)
}
