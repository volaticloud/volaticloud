package s3

import (
	"testing"
)

func TestParseConfig(t *testing.T) {
	tests := []struct {
		name    string
		data    map[string]interface{}
		wantErr bool
		check   func(*Config) bool
	}{
		{
			name: "valid complete config",
			data: map[string]interface{}{
				"endpoint":        "s3.amazonaws.com",
				"bucket":          "my-bucket",
				"accessKeyId":     "AKIAIOSFODNN7EXAMPLE",
				"secretAccessKey": "wJalrXUtnFEMI/K7MDENG",
				"region":          "eu-west-1",
				"forcePathStyle":  true,
				"useSSL":          false,
			},
			wantErr: false,
			check: func(c *Config) bool {
				return c.Endpoint == "s3.amazonaws.com" &&
					c.Bucket == "my-bucket" &&
					c.AccessKeyID == "AKIAIOSFODNN7EXAMPLE" &&
					c.SecretAccessKey == "wJalrXUtnFEMI/K7MDENG" &&
					c.Region == "eu-west-1" &&
					c.ForcePathStyle == true &&
					c.UseSSL == false
			},
		},
		{
			name: "valid minimal config with defaults",
			data: map[string]interface{}{
				"endpoint":        "minio.local:9000",
				"bucket":          "data",
				"accessKeyId":     "minioadmin",
				"secretAccessKey": "minioadmin",
			},
			wantErr: false,
			check: func(c *Config) bool {
				return c.Region == "us-east-1" && // default
					c.UseSSL == true // default
			},
		},
		{
			name:    "nil config",
			data:    nil,
			wantErr: true,
		},
		{
			name: "missing endpoint",
			data: map[string]interface{}{
				"bucket":          "my-bucket",
				"accessKeyId":     "key",
				"secretAccessKey": "secret",
			},
			wantErr: true,
		},
		{
			name: "missing bucket",
			data: map[string]interface{}{
				"endpoint":        "s3.amazonaws.com",
				"accessKeyId":     "key",
				"secretAccessKey": "secret",
			},
			wantErr: true,
		},
		{
			name: "missing accessKeyId",
			data: map[string]interface{}{
				"endpoint":        "s3.amazonaws.com",
				"bucket":          "my-bucket",
				"secretAccessKey": "secret",
			},
			wantErr: true,
		},
		{
			name: "missing secretAccessKey",
			data: map[string]interface{}{
				"endpoint":    "s3.amazonaws.com",
				"bucket":      "my-bucket",
				"accessKeyId": "key",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg, err := ParseConfig(tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseConfig() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && tt.check != nil && !tt.check(cfg) {
				t.Errorf("ParseConfig() config check failed")
			}
		})
	}
}

func TestValidateConfig(t *testing.T) {
	tests := []struct {
		name    string
		cfg     *Config
		wantErr bool
	}{
		{
			name: "valid config",
			cfg: &Config{
				Endpoint:        "s3.amazonaws.com",
				Bucket:          "my-bucket",
				AccessKeyID:     "key",
				SecretAccessKey: "secret",
			},
			wantErr: false,
		},
		{
			name:    "nil config",
			cfg:     nil,
			wantErr: true,
		},
		{
			name: "empty endpoint",
			cfg: &Config{
				Bucket:          "my-bucket",
				AccessKeyID:     "key",
				SecretAccessKey: "secret",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateConfig(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateConfig() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestDataKey(t *testing.T) {
	key := DataKey("runner-123")
	expected := "runners/data/runner-123.tar.gz"
	if key != expected {
		t.Errorf("DataKey() = %v, want %v", key, expected)
	}
}

func TestConfigToMap(t *testing.T) {
	cfg := &Config{
		Endpoint:        "s3.amazonaws.com",
		Bucket:          "my-bucket",
		AccessKeyID:     "key",
		SecretAccessKey: "secret",
		Region:          "us-west-2",
		ForcePathStyle:  true,
		UseSSL:          true,
	}

	m := cfg.ToMap()

	if m["endpoint"] != cfg.Endpoint {
		t.Errorf("ToMap() endpoint = %v, want %v", m["endpoint"], cfg.Endpoint)
	}
	if m["bucket"] != cfg.Bucket {
		t.Errorf("ToMap() bucket = %v, want %v", m["bucket"], cfg.Bucket)
	}
	if m["accessKeyId"] != cfg.AccessKeyID {
		t.Errorf("ToMap() accessKeyId = %v, want %v", m["accessKeyId"], cfg.AccessKeyID)
	}
	if m["forcePathStyle"] != cfg.ForcePathStyle {
		t.Errorf("ToMap() forcePathStyle = %v, want %v", m["forcePathStyle"], cfg.ForcePathStyle)
	}
}
