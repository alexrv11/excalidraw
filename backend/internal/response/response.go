package response

import (
	"encoding/json"

	"github.com/aws/aws-lambda-go/events"
)

func JSON(statusCode int, body any) events.APIGatewayProxyResponse {
	b, _ := json.Marshal(body)
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(b),
	}
}

func Text(statusCode int, body string) events.APIGatewayProxyResponse {
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    map[string]string{"Content-Type": "text/plain"},
		Body:       body,
	}
}

func Binary(statusCode int, data []byte, contentType string) events.APIGatewayProxyResponse {
	return events.APIGatewayProxyResponse{
		StatusCode:      statusCode,
		Headers:         map[string]string{"Content-Type": contentType},
		Body:            string(data), // API GW base64-encodes when isBase64Encoded=true
		IsBase64Encoded: true,
	}
}

func Error(statusCode int, msg string) events.APIGatewayProxyResponse {
	return JSON(statusCode, map[string]string{"error": msg})
}
