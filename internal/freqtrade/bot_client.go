package freqtrade

import (
	"context"
	"fmt"
	"net/http"
)

// BotClient wraps the generated Freqtrade API client with authentication and convenience methods
type BotClient struct {
	client   *APIClient
	username string
	password string
}

// NewBotClient creates a new authenticated Freqtrade client for a bot
func NewBotClient(baseURL, username, password string) *BotClient {
	config := NewConfiguration()
	config.Servers = ServerConfigurations{
		{
			URL:         baseURL,
			Description: "Freqtrade API Server",
		},
	}

	return &BotClient{
		client:   NewAPIClient(config),
		username: username,
		password: password,
	}
}

// NewBotClientFromContainerIP creates a client using container IP and API port
func NewBotClientFromContainerIP(containerIP string, apiPort int, username, password string) *BotClient {
	if apiPort == 0 {
		apiPort = 8080 // Default Freqtrade API port
	}
	baseURL := fmt.Sprintf("http://%s:%d", containerIP, apiPort)
	return NewBotClient(baseURL, username, password)
}

// contextWithAuth adds HTTP Basic Auth to the context
func (c *BotClient) contextWithAuth(ctx context.Context) context.Context {
	return context.WithValue(ctx, ContextBasicAuth, BasicAuth{
		UserName: c.username,
		Password: c.password,
	})
}

// GetProfit fetches profit statistics from the bot
func (c *BotClient) GetProfit(ctx context.Context) (*Profit, error) {
	ctx = c.contextWithAuth(ctx)

	profit, resp, err := c.client.FreqtradeAPI.ProfitApiV1ProfitGet(ctx).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch profit: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return profit, nil
}

// GetStatus fetches current bot status including open trades
func (c *BotClient) GetStatus(ctx context.Context) ([]OpenTradeSchema, error) {
	ctx = c.contextWithAuth(ctx)

	status, resp, err := c.client.FreqtradeAPI.StatusApiV1StatusGet(ctx).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch status: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return status, nil
}

// GetBalance fetches current balance information
func (c *BotClient) GetBalance(ctx context.Context) (*Balances, error) {
	ctx = c.contextWithAuth(ctx)

	balance, resp, err := c.client.FreqtradeAPI.BalanceApiV1BalanceGet(ctx).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch balance: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return balance, nil
}

// GetPerformance fetches performance statistics by trading pair
func (c *BotClient) GetPerformance(ctx context.Context) ([]PerformanceEntry, error) {
	ctx = c.contextWithAuth(ctx)

	performance, resp, err := c.client.FreqtradeAPI.PerformanceApiV1PerformanceGet(ctx).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch performance: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return performance, nil
}

// Ping checks if the Freqtrade API is accessible
func (c *BotClient) Ping(ctx context.Context) error {
	ctx = c.contextWithAuth(ctx)

	_, resp, err := c.client.FreqtradeAPI.PingApiV1PingGet(ctx).Execute()
	if err != nil {
		return fmt.Errorf("failed to ping: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

// Login authenticates with the bot and returns access/refresh tokens
func (c *BotClient) Login(ctx context.Context) (*AccessAndRefreshToken, error) {
	ctx = c.contextWithAuth(ctx)

	tokens, resp, err := c.client.FreqtradeAPI.TokenLoginApiV1TokenLoginPost(ctx).Execute()
	if err != nil {
		return nil, fmt.Errorf("failed to login: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return tokens, nil
}

// GetUsername returns the username used for authentication
func (c *BotClient) GetUsername() string {
	return c.username
}
