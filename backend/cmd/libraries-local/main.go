// libraries-local: thin net/http wrapper around libraryhandler.Handler for local development.
// Translates standard HTTP requests into APIGatewayV2HTTPRequest structs so the same handler
// code runs locally without Lambda.
//
// Usage:
//   LIBRARIES_TABLE=Libraries USER_LIBRARIES_TABLE=UserLibraries \
//   AWS_ENDPOINT_URL=http://localhost:8000 AWS_REGION=us-east-1 \
//   go run ./cmd/libraries-local
package main

import (
	"context"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/excalidraw/backend/internal/libraryhandler"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}

	mux := http.NewServeMux()

	// CORS pre-flight
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "content-type, authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Extract proxy segment: everything after /libraries/
		path := strings.TrimPrefix(r.URL.Path, "/libraries")
		proxy := strings.TrimPrefix(path, "/")

		// Query string parameters (first value only).
		qp := make(map[string]string)
		for k, v := range r.URL.Query() {
			if len(v) > 0 {
				qp[k] = v[0]
			}
		}

		// Headers (lowercase, matching API Gateway v2 behaviour).
		headers := make(map[string]string)
		for k, v := range r.Header {
			if len(v) > 0 {
				headers[strings.ToLower(k)] = v[0]
			}
		}

		// Body (for POST/PUT).
		body := ""
		if r.Body != nil {
			b, _ := io.ReadAll(r.Body)
			body = string(b)
		}

		req := events.APIGatewayV2HTTPRequest{
			RequestContext: events.APIGatewayV2HTTPRequestContext{
				HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
					Method: r.Method,
				},
			},
			PathParameters:        map[string]string{"proxy": proxy},
			QueryStringParameters: qp,
			Headers:               headers,
			Body:                  body,
		}

		resp, err := libraryhandler.Handler(context.Background(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		for k, v := range resp.Headers {
			w.Header().Set(k, v)
		}
		if w.Header().Get("Content-Type") == "" {
			w.Header().Set("Content-Type", "application/json")
		}
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write([]byte(resp.Body))
	})

	log.Printf("libraries-local listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
