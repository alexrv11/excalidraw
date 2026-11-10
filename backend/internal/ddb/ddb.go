package ddb

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

var client *dynamodb.Client

func Client() *dynamodb.Client {
	if client != nil {
		return client
	}
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		panic("failed to load AWS config: " + err.Error())
	}
	client = dynamodb.NewFromConfig(cfg)
	return client
}

// TableName returns the DynamoDB table name from an environment variable.
func TableName(envKey string) string {
	name := os.Getenv(envKey)
	if name == "" {
		panic("missing required env var: " + envKey)
	}
	return name
}
