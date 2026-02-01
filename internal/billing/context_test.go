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

func TestConsoleURLContext(t *testing.T) {
	t.Run("round-trips console URL through context", func(t *testing.T) {
		ctx := SetConsoleURLInContext(context.Background(), "https://console.volaticloud.com")

		got := GetConsoleURLFromContext(ctx)
		assert.Equal(t, "https://console.volaticloud.com", got)
	})

	t.Run("returns empty string when not set", func(t *testing.T) {
		got := GetConsoleURLFromContext(context.Background())
		assert.Equal(t, "", got)
	})
}
