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

		// Create reverse proxy
		proxy := httputil.NewSingleHostReverseProxy(targetURL)

		// Customize the director to strip the /gateway/v1/bot/{id} prefix
		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)

			// Strip /gateway/v1/bot/{id} prefix from path
			// e.g., /gateway/v1/bot/123/api/v1/status -> /api/v1/status
			prefix := "/gateway/v1/bot/" + botIDStr
			if strings.HasPrefix(req.URL.Path, prefix) {
				req.URL.Path = strings.TrimPrefix(req.URL.Path, prefix)
				if req.URL.Path == "" {
					req.URL.Path = "/"
				}
			}

			// Update raw path as well
			req.URL.RawPath = req.URL.Path

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

	// Check if bot has a container
	if b.ContainerID == "" {
		return nil, fmt.Errorf("bot is not running (no container)")
	}

	// Get runner
	botRunner := b.Edges.Runner
	if botRunner == nil {
		return nil, fmt.Errorf("bot has no runner configuration")
	}

	// Create runner client
	rt, err := p.factory.Create(ctx, botRunner.Type, botRunner.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create runner client: %w", err)
	}
	defer rt.Close()

	// Get bot status to find the mapped host port
	status, err := rt.GetBotStatus(ctx, b.ContainerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get bot status: %w", err)
	}

	// Check if we have a mapped host port
	if status.HostPort == 0 {
		return nil, fmt.Errorf("bot container has no mapped port")
	}

	// Extract Docker host from runner config
	// Config format: {"host": "tcp://hostname:2376", ...}
	dockerHost := runner.ExtractDockerHostFromConfig(botRunner.Config)
	if dockerHost == "" {
		return nil, fmt.Errorf("could not determine Docker host from runner config")
	}

	targetURL, err := url.Parse(fmt.Sprintf("http://%s:%d", dockerHost, status.HostPort))
	if err != nil {
		return nil, fmt.Errorf("failed to build target URL: %w", err)
	}

	return targetURL, nil
}
