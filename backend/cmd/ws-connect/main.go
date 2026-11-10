package main

import (
	"context"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/excalidraw/backend/internal/apigw"
	"github.com/excalidraw/backend/internal/response"
)

// $connect — fires when a WebSocket client opens a connection.
//
// Sends a "connection-ack" message back to the new client so that
// awsSocket.ts can set socket.id = connectionId and then fire the
// synthetic "init-room" event that triggers Portal.tsx to emit "join-room".
func handler(ctx context.Context, event events.APIGatewayWebsocketProxyRequest) (events.APIGatewayProxyResponse, error) {
	connectionID := event.RequestContext.ConnectionID

	client, err := apigw.NewClient(ctx, event)
	if err != nil {
		return response.Text(500, "failed to init management client"), nil
	}

	apigw.Send(ctx, client, connectionID, map[string]any{ //nolint:errcheck
		"event":        "connection-ack",
		"connectionId": connectionID,
	})

	return response.Text(200, "Connected"), nil
}

func main() {
	lambda.Start(handler)
}
