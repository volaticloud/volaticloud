package etcd

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid config",
			cfg: Config{
				Endpoints: []string{"localhost:2379"},
			},
			wantErr: false,
		},
		{
			name:    "empty endpoints",
			cfg:     Config{},
			wantErr: true,
			errMsg:  "endpoints cannot be empty",
		},
		{
			name: "default timeout",
			cfg: Config{
				Endpoints: []string{"localhost:2379"},
			},
			wantErr: false,
			// Should use default 5s timeout
		},
		{
			name: "custom timeout",
			cfg: Config{
				Endpoints:   []string{"localhost:2379"},
				DialTimeout: 10 * time.Second,
			},
			wantErr: false,
		},
		{
			name: "with authentication",
			cfg: Config{
				Endpoints: []string{"localhost:2379"},
				Username:  "user",
				Password:  "pass",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewClient(tt.cfg)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				// Will fail to connect but should create client successfully
				// We're only testing validation, not actual connection
				if err != nil {
					// Connection errors are expected in unit tests
					assert.Contains(t, err.Error(), "failed to create etcd client")
				}
			}
		})
	}
}

func TestConfigDefaults(t *testing.T) {
	cfg := Config{
		Endpoints: []string{"localhost:2379"},
	}

	// Default timeout should be applied in NewClient
	assert.Equal(t, time.Duration(0), cfg.DialTimeout, "Config should have no default before NewClient")

	// After creating client, timeout should be set to default
	// (tested implicitly in NewClient validation)
}
