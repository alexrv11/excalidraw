package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"

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
	// Strip leading slash if present
	key = strings.TrimPrefix(key, "/")

	if req.Body == "" {
		return response.Error(400, "empty body"), nil
	}

	var data []byte
	if req.IsBase64Encoded {
		decoded, err := base64.StdEncoding.DecodeString(req.Body)
		if err != nil {
			return response.Error(400, "invalid base64 body"), nil
		}
		data = decoded
	} else {
		data = []byte(req.Body)
	}

	contentType := req.Headers["content-type"]
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	bucketName := os.Getenv("FILES_BUCKET")
	if bucketName == "" {
		return response.Error(500, "FILES_BUCKET not configured"), nil
	}

	_, err := s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(bucketName),
		Key:          aws.String(key),
		Body:         bytes.NewReader(data),
		ContentType:  aws.String(contentType),
		CacheControl: aws.String("public, max-age=31536000"),
	})
	if err != nil {
		return response.Error(500, "failed to upload: "+err.Error()), nil
	}

	return response.Text(200, "OK"), nil
}

func main() {
	lambda.Start(handler)
}
