package auth

import (
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-lambda-go/events"
)

// ─── Claims ─────────────────────────────────────────────────────────────────

// Claims represents the verified identity from any token type.
type Claims struct {
	Sub       string `json:"sub"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	SessionID string `json:"sid,omitempty"`
}

// ─── Session tokens (HS256) ─────────────────────────────────────────────────

// sessionSecret returns the signing key for session tokens.
// Falls back to LOCAL_JWT_SECRET when SESSION_SECRET is not set.
func sessionSecret() string {
	if s := os.Getenv("SESSION_SECRET"); s != "" {
		return s
	}
	return os.Getenv("LOCAL_JWT_SECRET")
}

// CreateSessionToken creates an HS256 JWT signed with SESSION_SECRET.
// Payload: sub, email, name, role, sid (session ID), iat, exp (7 days).
func CreateSessionToken(sub, email, name, role, sessionID string) (string, error) {
	secret := sessionSecret()
	if secret == "" {
		return "", fmt.Errorf("SESSION_SECRET (or LOCAL_JWT_SECRET) not set")
	}

	now := time.Now().Unix()
	exp := now + 7*24*60*60 // 7 days

	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	payload := map[string]any{
		"sub":   sub,
		"email": email,
		"name":  name,
		"role":  role,
		"sid":   sessionID,
		"iat":   now,
		"exp":   exp,
	}

	return signHS256(header, payload, []byte(secret))
}

// VerifySessionToken verifies a session JWT (HS256) signed by this backend.
// Used on every API request after the initial auth/session exchange.
func VerifySessionToken(tokenStr string) (*Claims, error) {
	secret := sessionSecret()
	if secret == "" {
		return nil, fmt.Errorf("SESSION_SECRET (or LOCAL_JWT_SECRET) not set")
	}

	payload, err := verifyHS256(tokenStr, []byte(secret))
	if err != nil {
		return nil, err
	}

	var claims struct {
		Sub   string  `json:"sub"`
		Email string  `json:"email"`
		Name  string  `json:"name"`
		Role  string  `json:"role"`
		Sid   string  `json:"sid"`
		Exp   float64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("parse session claims: %w", err)
	}
	if time.Now().Unix() > int64(claims.Exp) {
		return nil, fmt.Errorf("session token expired")
	}

	return &Claims{
		Sub:       claims.Sub,
		Email:     claims.Email,
		Name:      claims.Name,
		Role:      claims.Role,
		SessionID: claims.Sid,
	}, nil
}

// ─── Local dev tokens (HS256) ───────────────────────────────────────────────

// VerifyLocalDevToken validates an HS256 JWT signed with LOCAL_JWT_SECRET.
// Used during POST /api/v1/auth/session in local dev mode.
func VerifyLocalDevToken(tokenStr string) (*Claims, error) {
	secret := os.Getenv("LOCAL_JWT_SECRET")
	if secret == "" {
		return nil, fmt.Errorf("LOCAL_JWT_SECRET not set")
	}

	payload, err := verifyHS256(tokenStr, []byte(secret))
	if err != nil {
		return nil, err
	}

	var claims struct {
		Sub   string  `json:"sub"`
		Email string  `json:"email"`
		Name  string  `json:"name"`
		Role  string  `json:"role"`
		Exp   float64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("parse local dev claims: %w", err)
	}
	if time.Now().Unix() > int64(claims.Exp) {
		return nil, fmt.Errorf("local dev token expired")
	}

	return &Claims{
		Sub:   claims.Sub,
		Email: claims.Email,
		Name:  claims.Name,
		Role:  claims.Role,
	}, nil
}

// ─── Auth0 tokens (RS256) ───────────────────────────────────────────────────

type jwkSet struct {
	Keys []struct {
		Kid string `json:"kid"`
		Kty string `json:"kty"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

var (
	jwksMu        sync.RWMutex
	jwksKeys      map[string]*rsa.PublicKey
	jwksFetchedAt time.Time
)

const jwksTTL = time.Hour

func getPublicKey(kid string) (*rsa.PublicKey, error) {
	jwksMu.RLock()
	if jwksKeys != nil && time.Since(jwksFetchedAt) < jwksTTL {
		key := jwksKeys[kid]
		jwksMu.RUnlock()
		if key != nil {
			return key, nil
		}
	} else {
		jwksMu.RUnlock()
	}

	jwksMu.Lock()
	defer jwksMu.Unlock()

	domain := os.Getenv("AUTH0_DOMAIN")
	resp, err := http.Get("https://" + domain + "/.well-known/jwks.json") //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("fetch jwks: %w", err)
	}
	defer resp.Body.Close()

	var set jwkSet
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return nil, fmt.Errorf("decode jwks: %w", err)
	}

	m := make(map[string]*rsa.PublicKey)
	for _, k := range set.Keys {
		if k.Kty != "RSA" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		e := 0
		for _, b := range eBytes {
			e = e<<8 | int(b)
		}
		m[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: e}
	}
	jwksKeys = m
	jwksFetchedAt = time.Now()

	if key := m[kid]; key != nil {
		return key, nil
	}
	return nil, fmt.Errorf("kid %q not found in jwks", kid)
}

// VerifyAuth0Token validates an Auth0 RS256 JWT and returns the identity claims.
// Used once during POST /api/v1/auth/session to verify the Auth0 token.
func VerifyAuth0Token(tokenStr string) (*Claims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid jwt format")
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("decode header: %w", err)
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("parse header: %w", err)
	}
	if header.Alg != "RS256" {
		return nil, fmt.Errorf("unsupported alg: %s", header.Alg)
	}

	pubKey, err := getPublicKey(header.Kid)
	if err != nil {
		return nil, err
	}

	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("decode signature: %w", err)
	}
	h := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, h[:], sigBytes); err != nil {
		return nil, fmt.Errorf("invalid signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode payload: %w", err)
	}
	var claims struct {
		Sub   string  `json:"sub"`
		Email string  `json:"email"`
		Name  string  `json:"name"`
		Exp   float64 `json:"exp"`
	}
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("parse claims: %w", err)
	}
	if time.Now().Unix() > int64(claims.Exp) {
		return nil, fmt.Errorf("token expired")
	}

	return &Claims{
		Sub:   claims.Sub,
		Email: claims.Email,
		Name:  claims.Name,
	}, nil
}

// ─── HS256 helpers ──────────────────────────────────────────────────────────

// signHS256 builds a JWT from header + payload maps and signs it with HMAC-SHA256.
func signHS256(header map[string]string, payload map[string]any, secret []byte) (string, error) {
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", fmt.Errorf("marshal header: %w", err)
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal payload: %w", err)
	}

	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)

	signingInput := headerB64 + "." + payloadB64

	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(signingInput))
	sig := mac.Sum(nil)

	sigB64 := base64.RawURLEncoding.EncodeToString(sig)

	return signingInput + "." + sigB64, nil
}

// verifyHS256 splits a JWT, verifies the HMAC-SHA256 signature, and returns the raw payload bytes.
func verifyHS256(tokenStr string, secret []byte) ([]byte, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid jwt format")
	}

	// Verify algorithm header.
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("decode header: %w", err)
	}
	var header struct {
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("parse header: %w", err)
	}
	if header.Alg != "HS256" {
		return nil, fmt.Errorf("unsupported alg: %s", header.Alg)
	}

	// Verify signature.
	signingInput := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(signingInput))
	expectedSig := mac.Sum(nil)

	actualSig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("decode signature: %w", err)
	}
	if !hmac.Equal(expectedSig, actualSig) {
		return nil, fmt.Errorf("invalid signature")
	}

	// Decode payload.
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode payload: %w", err)
	}

	return payload, nil
}

// ─── Utilities ──────────────────────────────────────────────────────────────

// BearerToken extracts the Bearer token from the Authorization header.
// HTTP API v2.0 normalises headers to lowercase.
func BearerToken(req events.APIGatewayV2HTTPRequest) (string, bool) {
	auth := req.Headers["authorization"]
	return strings.CutPrefix(auth, "Bearer ")
}

// IsLocalDev returns true if LOCAL_JWT_SECRET is set (local dev mode).
func IsLocalDev() bool {
	return os.Getenv("LOCAL_JWT_SECRET") != ""
}

// GenerateSessionID returns a random 16-byte hex string for session IDs.
func GenerateSessionID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
