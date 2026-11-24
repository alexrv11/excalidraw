package main

import (
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/excalidraw/backend/internal/authhandler"
)

func main() {
	lambda.Start(authhandler.Handler)
}
