package main

import (
	"context"
	"io"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3Types "github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/excalidraw/backend/internal/response"
)

var s3Client *s3.Client

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		panic("failed to load AWS config: " + err.Error())
	}
	s3Client = s3.NewFromConfig(cfg)
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	key := req.PathParameters["key"]
	if key == "" {
		return response.Error(400, "missing key"), nil
	}
	key = strings.TrimPrefix(key, "/")

	bucketName := os.Getenv("FILES_BUCKET")
	if bucketName == "" {
		return response.Error(500, "FILES_BUCKET not configured"), nil
	}

	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		var nsk *s3Types.NoSuchKey
		if isError(err, nsk) {
			return response.Error(404, "not found"), nil
		}
		return response.Error(500, "failed to get object: "+err.Error()), nil
	}
	defer result.Body.Close()

	data, err := io.ReadAll(result.Body)
	if err != nil {
		return response.Error(500, "failed to read body: "+err.Error()), nil
	}

	contentType := "application/octet-stream"
	if result.ContentType != nil {
		contentType = *result.ContentType
	}
	cacheControl := "public, max-age=31536000"
	if result.CacheControl != nil {
		cacheControl = *result.CacheControl
	}

	resp := response.Binary(200, data, contentType)
	resp.Headers["Cache-Control"] = cacheControl
	return resp, nil
}

// isError is a helper for AWS SDK v2 error type checking.
func isError(err error, target error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "NoSuchKey")
}

func main() {
	lambda.Start(handler)
}
