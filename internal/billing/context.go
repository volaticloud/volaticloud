package billing

import "context"

type contextKey string

const (
	stripeClientKey contextKey = "stripeClient"
	consoleURLKey   contextKey = "consoleURL"
)

// SetStripeClientInContext stores the Stripe client in context.
func SetStripeClientInContext(ctx context.Context, client *StripeClient) context.Context {
	return context.WithValue(ctx, stripeClientKey, client)
}

// GetStripeClientFromContext retrieves the Stripe client from context.
func GetStripeClientFromContext(ctx context.Context) *StripeClient {
	client, _ := ctx.Value(stripeClientKey).(*StripeClient)
	return client
}

// SetConsoleURLInContext stores the configured console URL in context.
func SetConsoleURLInContext(ctx context.Context, url string) context.Context {
	return context.WithValue(ctx, consoleURLKey, url)
}

// GetConsoleURLFromContext retrieves the configured console URL from context.
func GetConsoleURLFromContext(ctx context.Context) string {
	url, _ := ctx.Value(consoleURLKey).(string)
	return url
}
