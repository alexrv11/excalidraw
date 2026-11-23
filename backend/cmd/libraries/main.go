package main

import (
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/excalidraw/backend/internal/libraryhandler"
)

func main() {
	lambda.Start(libraryhandler.Handler)
}
