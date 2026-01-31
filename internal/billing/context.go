package billing

import "context"

type contextKey string

const (
	stripeClientKey contextKey = "stripeClient"
	frontendURLKey  contextKey = "frontendURL"
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

// SetFrontendURLInContext stores the configured frontend URL in context.
func SetFrontendURLInContext(ctx context.Context, url string) context.Context {
	return context.WithValue(ctx, frontendURLKey, url)
}

// GetFrontendURLFromContext retrieves the configured frontend URL from context.
func GetFrontendURLFromContext(ctx context.Context) string {
	url, _ := ctx.Value(frontendURLKey).(string)
	return url
}
