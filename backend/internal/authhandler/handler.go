package authhandler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/excalidraw/backend/internal/auth"
	"github.com/excalidraw/backend/internal/ddb"
	"github.com/excalidraw/backend/internal/response"
)

// ─── Table names ──────────────────────────────────────────────────────────────

var (
	UsersTable       string
	SessionsTable    string
	InviteCodesTable string
)

func init() {
	UsersTable = ddb.TableName("USERS_TABLE")
	SessionsTable = ddb.TableName("SESSIONS_TABLE")
	InviteCodesTable = ddb.TableName("INVITE_CODES_TABLE")
}

// ─── Data types ───────────────────────────────────────────────────────────────

type sessionRequest struct {
	Auth0Token string `json:"auth0Token"`
	InviteCode string `json:"inviteCode"`
	LocalDev   bool   `json:"localDev"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	Role       string `json:"role"`
}

type userRecord struct {
	Sub        string `json:"sub" dynamodbav:"sub"`
	Email      string `json:"email" dynamodbav:"email"`
	Name       string `json:"name" dynamodbav:"name"`
	Role       string `json:"role" dynamodbav:"role"`
	InviteCode string `json:"inviteCode,omitempty" dynamodbav:"inviteCode,omitempty"`
	CreatedAt  string `json:"createdAt" dynamodbav:"createdAt"`
}

// ─── POST /api/v1/auth/session ────────────────────────────────────────────────

func handleSession(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	var body sessionRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response.Error(http.StatusBadRequest, "invalid request body"), nil
	}

	var sub, email, name, role string

	switch {
	case body.Auth0Token != "":
		// ── Production flow: verify Auth0 token ──────────────────────────
		auth0Claims, err := auth.VerifyAuth0Token(body.Auth0Token)
		if err != nil {
			return response.Error(http.StatusForbidden, "invalid auth0 token: "+err.Error()), nil
		}
		sub = auth0Claims.Sub
		email = auth0Claims.Email
		name = auth0Claims.Name

		// Look up existing user
		result, err := ddb.Client().GetItem(ctx, &dynamodb.GetItemInput{
			TableName: aws.String(UsersTable),
			Key: map[string]types.AttributeValue{
				"sub": &types.AttributeValueMemberS{Value: sub},
			},
		})
		if err != nil {
			return response.Error(http.StatusInternalServerError, "user lookup failed: "+err.Error()), nil
		}

		if result.Item == nil {
			// First login — require invite code
			if body.InviteCode == "" {
				return response.Error(http.StatusForbidden, "invite code required for first login"), nil
			}

			if err := validateAndConsumeInviteCode(ctx, body.InviteCode, sub); err != nil {
				return response.Error(http.StatusForbidden, err.Error()), nil
			}

			// Create user row
			role = "user"
			now := time.Now().UTC().Format(time.RFC3339)
			_, err = ddb.Client().PutItem(ctx, &dynamodb.PutItemInput{
				TableName: aws.String(UsersTable),
				Item: map[string]types.AttributeValue{
					"sub":        &types.AttributeValueMemberS{Value: sub},
					"email":      &types.AttributeValueMemberS{Value: email},
					"name":       &types.AttributeValueMemberS{Value: name},
					"role":       &types.AttributeValueMemberS{Value: role},
					"inviteCode": &types.AttributeValueMemberS{Value: body.InviteCode},
					"createdAt":  &types.AttributeValueMemberS{Value: now},
				},
			})
			if err != nil {
				return response.Error(http.StatusInternalServerError, "create user failed: "+err.Error()), nil
			}
		} else {
			// Existing user — load role from DB
			var existing userRecord
			if err := attributevalue.UnmarshalMap(result.Item, &existing); err != nil {
				return response.Error(http.StatusInternalServerError, "unmarshal user failed: "+err.Error()), nil
			}
			role = existing.Role
		}

	case body.LocalDev && auth.IsLocalDev():
		// ── Local dev flow ───────────────────────────────────────────────
		email = body.Email
		name = body.Name
		role = body.Role
		sub = "local|" + email

		now := time.Now().UTC().Format(time.RFC3339)
		_, err := ddb.Client().PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(UsersTable),
			Item: map[string]types.AttributeValue{
				"sub":       &types.AttributeValueMemberS{Value: sub},
				"email":     &types.AttributeValueMemberS{Value: email},
				"name":      &types.AttributeValueMemberS{Value: name},
				"role":      &types.AttributeValueMemberS{Value: role},
				"createdAt": &types.AttributeValueMemberS{Value: now},
			},
		})
		if err != nil {
			return response.Error(http.StatusInternalServerError, "upsert user failed: "+err.Error()), nil
		}

	default:
		return response.Error(http.StatusBadRequest, "provide auth0Token or enable localDev"), nil
	}

	// ── Create session ───────────────────────────────────────────────────
	sessionID := auth.GenerateSessionID()
	now := time.Now()
	expiresAt := now.Add(7 * 24 * time.Hour).Unix()

	_, err := ddb.Client().PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(SessionsTable),
		Item: map[string]types.AttributeValue{
			"sid":       &types.AttributeValueMemberS{Value: sessionID},
			"sub":       &types.AttributeValueMemberS{Value: sub},
			"createdAt": &types.AttributeValueMemberS{Value: now.UTC().Format(time.RFC3339)},
			"expiresAt": &types.AttributeValueMemberN{Value: strconv.FormatInt(expiresAt, 10)},
		},
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "create session failed: "+err.Error()), nil
	}

	token, err := auth.CreateSessionToken(sub, email, name, role, sessionID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "create token failed: "+err.Error()), nil
	}

	return response.JSON(http.StatusOK, map[string]any{
		"token": token,
		"user": map[string]string{
			"sub":   sub,
			"email": email,
			"name":  name,
			"role":  role,
		},
	}), nil
}

// validateAndConsumeInviteCode checks the invite code and atomically increments usage.
func validateAndConsumeInviteCode(ctx context.Context, code, sub string) error {
	result, err := ddb.Client().GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(InviteCodesTable),
		Key: map[string]types.AttributeValue{
			"code": &types.AttributeValueMemberS{Value: code},
		},
	})
	if err != nil {
		return fmt.Errorf("invite code lookup failed: %w", err)
	}
	if result.Item == nil {
		return fmt.Errorf("invalid invite code")
	}

	// Check revoked
	if revoked, ok := result.Item["revoked"]; ok {
		if b, ok := revoked.(*types.AttributeValueMemberBOOL); ok && b.Value {
			return fmt.Errorf("invite code has been revoked")
		}
	}

	// Check expiry
	if expiresAtAttr, ok := result.Item["expiresAt"]; ok {
		if s, ok := expiresAtAttr.(*types.AttributeValueMemberS); ok && s.Value != "" {
			if expiresAt, err := time.Parse(time.RFC3339, s.Value); err == nil {
				if time.Now().After(expiresAt) {
					return fmt.Errorf("invite code has expired")
				}
			}
		}
	}

	// Check maxUses / currentUses
	maxUses := int64(0)
	if mu, ok := result.Item["maxUses"]; ok {
		if n, ok := mu.(*types.AttributeValueMemberN); ok {
			maxUses, _ = strconv.ParseInt(n.Value, 10, 64)
		}
	}
	currentUses := int64(0)
	if cu, ok := result.Item["currentUses"]; ok {
		if n, ok := cu.(*types.AttributeValueMemberN); ok {
			currentUses, _ = strconv.ParseInt(n.Value, 10, 64)
		}
	}
	if maxUses > 0 && currentUses >= maxUses {
		return fmt.Errorf("invite code has reached maximum uses")
	}

	// Atomically increment currentUses and append sub to usedBy
	_, err = ddb.Client().UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(InviteCodesTable),
		Key: map[string]types.AttributeValue{
			"code": &types.AttributeValueMemberS{Value: code},
		},
		UpdateExpression: aws.String("SET currentUses = if_not_exists(currentUses, :zero) + :one, usedBy = list_append(if_not_exists(usedBy, :emptyList), :newUser)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":one":       &types.AttributeValueMemberN{Value: "1"},
			":zero":      &types.AttributeValueMemberN{Value: "0"},
			":emptyList": &types.AttributeValueMemberL{Value: []types.AttributeValue{}},
			":newUser":   &types.AttributeValueMemberL{Value: []types.AttributeValue{&types.AttributeValueMemberS{Value: sub}}},
		},
	})
	if err != nil {
		return fmt.Errorf("update invite code failed: %w", err)
	}

	return nil
}

// ─── GET /api/v1/auth/me ─────────────────────────────────────────────────────

func handleMe(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	token, ok := auth.BearerToken(req)
	if !ok {
		return response.Error(http.StatusUnauthorized, "missing authorization"), nil
	}

	claims, err := auth.VerifySessionToken(token)
	if err != nil {
		return response.Error(http.StatusForbidden, "invalid session: "+err.Error()), nil
	}

	result, err := ddb.Client().GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(UsersTable),
		Key: map[string]types.AttributeValue{
			"sub": &types.AttributeValueMemberS{Value: claims.Sub},
		},
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "user lookup failed: "+err.Error()), nil
	}
	if result.Item == nil {
		return response.Error(http.StatusNotFound, "user not found"), nil
	}

	var user userRecord
	if err := attributevalue.UnmarshalMap(result.Item, &user); err != nil {
		return response.Error(http.StatusInternalServerError, "unmarshal failed: "+err.Error()), nil
	}

	return response.JSON(http.StatusOK, map[string]string{
		"sub":   user.Sub,
		"email": user.Email,
		"name":  user.Name,
		"role":  user.Role,
	}), nil
}

// ─── POST /api/v1/auth/logout ────────────────────────────────────────────────

func handleLogout(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	token, ok := auth.BearerToken(req)
	if !ok {
		return response.Error(http.StatusUnauthorized, "missing authorization"), nil
	}

	claims, err := auth.VerifySessionToken(token)
	if err != nil {
		return response.Error(http.StatusForbidden, "invalid session: "+err.Error()), nil
	}

	sid := claims.SessionID
	if sid == "" {
		return response.Error(http.StatusBadRequest, "no session id in token"), nil
	}

	_, err = ddb.Client().DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(SessionsTable),
		Key: map[string]types.AttributeValue{
			"sid": &types.AttributeValueMemberS{Value: sid},
		},
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "delete session failed: "+err.Error()), nil
	}

	return response.JSON(http.StatusOK, map[string]bool{"ok": true}), nil
}

// ─── Main handler ─────────────────────────────────────────────────────────────

// Handler is the Lambda (and local HTTP) entry point.
func Handler(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	method := req.RequestContext.HTTP.Method
	proxy := req.PathParameters["proxy"]

	// proxy will be "session", "me", or "logout"
	segments := strings.SplitN(proxy, "/", 2)
	route := ""
	if len(segments) > 0 {
		route = segments[0]
	}

	switch {
	case method == "POST" && route == "session":
		return handleSession(ctx, req)
	case method == "GET" && route == "me":
		return handleMe(ctx, req)
	case method == "POST" && route == "logout":
		return handleLogout(ctx, req)
	default:
		return response.Error(http.StatusNotFound, "not found"), nil
	}
}
