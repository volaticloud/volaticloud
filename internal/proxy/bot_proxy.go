// Package proxy provides HTTP reverse proxy functionality for bot containers.
package proxy

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/bot"
	"volaticloud/internal/runner"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// BotProxy handles reverse proxy requests to bot containers.
type BotProxy struct {
	client  *ent.Client
	factory *runner.Factory
}

// NewBotProxy creates a new bot proxy handler.
func NewBotProxy(client *ent.Client) *BotProxy {
	return &BotProxy{
		client:  client,
		factory: runner.NewFactory(),
	}
}

// Handler returns an http.Handler that proxies requests to bot containers.
// URL pattern: /gateway/v1/bot/{id}/* where {id} is the bot UUID
// All requests are forwarded to the bot's Freqtrade API.
func (p *BotProxy) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract bot ID from URL
		botIDStr := chi.URLParam(r, "id")
		if botIDStr == "" {
			http.Error(w, "bot ID is required", http.StatusBadRequest)
			return
		}

		botID, err := uuid.Parse(botIDStr)
		if err != nil {
			http.Error(w, "invalid bot ID format", http.StatusBadRequest)
			return
		}

		// Get bot target URL
		targetURL, err := p.getBotTargetURL(r.Context(), botID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}

		// Strip /gateway/v1/bot/{id} prefix from request path
		// e.g., /gateway/v1/bot/123/api/v1/status -> /api/v1/status
		prefix := "/gateway/v1/bot/" + botIDStr
		strippedPath := strings.TrimPrefix(r.URL.Path, prefix)
		if strippedPath == "" {
			strippedPath = "/"
		}

		// Build full target URL by joining target base path with stripped path
		// Target URL may have a path (e.g., /bot/{id}/ for K8s ingress)
		fullPath := strings.TrimSuffix(targetURL.Path, "/") + strippedPath

		// Create reverse proxy with base URL (scheme + host only)
		baseURL := &url.URL{
			Scheme: targetURL.Scheme,
			Host:   targetURL.Host,
		}
		proxy := httputil.NewSingleHostReverseProxy(baseURL)

		// Customize the director to set the correct path
		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)

			// Set the full path (target path + stripped request path)
			req.URL.Path = fullPath
			req.URL.RawPath = fullPath

			// Set host header
			req.Host = targetURL.Host
		}

		// Custom error handler
		proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
			http.Error(w, fmt.Sprintf("proxy error: %v", err), http.StatusBadGateway)
		}

		// Forward the request
		proxy.ServeHTTP(w, r)
	})
}

// getBotTargetURL retrieves the target URL for a bot's Freqtrade API.
// Uses the runtime's GetBotAPIURL method which handles Docker, Kubernetes, etc.
func (p *BotProxy) getBotTargetURL(ctx context.Context, botID uuid.UUID) (*url.URL, error) {
	// Load bot with runner
	b, err := p.client.Bot.Query().
		Where(bot.ID(botID)).
		WithRunner().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, fmt.Errorf("bot not found")
		}
		return nil, fmt.Errorf("failed to load bot: %w", err)
	}

	// Get runner
	botRunner := b.Edges.Runner
	if botRunner == nil {
		return nil, fmt.Errorf("bot has no runner configuration")
	}

	// Create runtime client
	rt, err := p.factory.Create(ctx, botRunner.Type, botRunner.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create runtime client: %w", err)
	}
	defer rt.Close()

	// Get bot API URL from runtime (handles Docker, Kubernetes, etc.)
	apiURL, err := rt.GetBotAPIURL(ctx, b.ID.String())
	if err != nil {
		return nil, fmt.Errorf("failed to get bot API URL: %w", err)
	}

	targetURL, err := url.Parse(apiURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse bot API URL: %w", err)
	}

	return targetURL, nil
}
