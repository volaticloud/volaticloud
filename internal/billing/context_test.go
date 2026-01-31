package billing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStripeClientContext(t *testing.T) {
	t.Run("round-trips stripe client through context", func(t *testing.T) {
		sc := &StripeClient{}
		ctx := SetStripeClientInContext(context.Background(), sc)

		got := GetStripeClientFromContext(ctx)
		assert.Same(t, sc, got)
	})

	t.Run("returns nil when not set", func(t *testing.T) {
		got := GetStripeClientFromContext(context.Background())
		assert.Nil(t, got)
	})
}

func TestFrontendURLContext(t *testing.T) {
	t.Run("round-trips frontend URL through context", func(t *testing.T) {
		ctx := SetFrontendURLInContext(context.Background(), "https://app.example.com")

		got := GetFrontendURLFromContext(ctx)
		assert.Equal(t, "https://app.example.com", got)
	})

	t.Run("returns empty string when not set", func(t *testing.T) {
		got := GetFrontendURLFromContext(context.Background())
		assert.Equal(t, "", got)
	})
}
