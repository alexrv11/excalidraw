package main

import (
	"context"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbTypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/excalidraw/backend/internal/ddb"
	"github.com/excalidraw/backend/internal/response"
)

type shareLinkItem struct {
	ID   string `dynamodbav:"id"`
	Data []byte `dynamodbav:"data"`
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	id := req.PathParameters["id"]
	if id == "" {
		return response.Error(400, "missing id"), nil
	}

	result, err := ddb.Client().GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(ddb.TableName("SHARE_LINKS_TABLE")),
		Key: map[string]ddbTypes.AttributeValue{
			"id": &ddbTypes.AttributeValueMemberS{Value: id},
		},
	})
	if err != nil {
		return response.Error(500, "failed to get item: "+err.Error()), nil
	}
	if result.Item == nil {
		return response.Error(404, "not found"), nil
	}

	var item shareLinkItem
	if err := attributevalue.UnmarshalMap(result.Item, &item); err != nil {
		return response.Error(500, "unmarshal error"), nil
	}

	return response.Binary(200, item.Data, "application/octet-stream"), nil
}

func main() {
	lambda.Start(handler)
}
