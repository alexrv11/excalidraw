package apigw

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/apigatewaymanagementapi"
	apigwTypes "github.com/aws/aws-sdk-go-v2/service/apigatewaymanagementapi/types"
)

// NewClient creates an API Gateway Management API client scoped to the
// WebSocket stage extracted from the Lambda event's request context.
func NewClient(ctx context.Context, event events.APIGatewayWebsocketProxyRequest) (*apigatewaymanagementapi.Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}
	endpoint := fmt.Sprintf("https://%s/%s",
		event.RequestContext.DomainName,
		event.RequestContext.Stage,
	)
	client := apigatewaymanagementapi.NewFromConfig(cfg, func(o *apigatewaymanagementapi.Options) {
		o.BaseEndpoint = aws.String(endpoint)
	})
	return client, nil
}

// Send serialises payload as JSON and posts it to connectionID.
// Returns false (without error) when the connection is gone (HTTP 410).
func Send(ctx context.Context, client *apigatewaymanagementapi.Client, connectionID string, payload any) (bool, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return false, fmt.Errorf("marshal payload: %w", err)
	}
	_, err = client.PostToConnection(ctx, &apigatewaymanagementapi.PostToConnectionInput{
		ConnectionId: aws.String(connectionID),
		Data:         data,
	})
	if err != nil {
		var gone *apigwTypes.GoneException
		if errors.As(err, &gone) {
			return false, nil // stale connection — caller should clean up
		}
		return false, err
	}
	return true, nil
}

// Delete forcibly closes a WebSocket connection.
func Delete(ctx context.Context, client *apigatewaymanagementapi.Client, connectionID string) {
	_, _ = client.DeleteConnection(ctx, &apigatewaymanagementapi.DeleteConnectionInput{
		ConnectionId: aws.String(connectionID),
	})
}
