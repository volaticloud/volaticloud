package s3

import (
	"errors"
	"fmt"
)

// Config holds S3 connection configuration.
// Supports AWS S3, MinIO, Backblaze B2, and other S3-compatible storage.
type Config struct {
	// Endpoint is the S3 endpoint URL (e.g., "s3.amazonaws.com" or "minio.local:9000")
	Endpoint string

	// Bucket is the S3 bucket name
	Bucket string

	// AccessKeyID is the S3 access key ID
	AccessKeyID string

	// SecretAccessKey is the S3 secret access key
	SecretAccessKey string

	// Region is the S3 region (default: "us-east-1")
	Region string

	// ForcePathStyle forces path-style addressing (required for MinIO)
	// When true: http://endpoint/bucket/key
	// When false: http://bucket.endpoint/key (virtual-hosted style)
	ForcePathStyle bool

	// UseSSL enables HTTPS connections (default: true)
	UseSSL bool
}

// ParseConfig parses S3 configuration from a map (from JSON/GraphQL input).
func ParseConfig(data map[string]interface{}) (*Config, error) {
	if data == nil {
		return nil, errors.New("s3 config is nil")
	}

	cfg := &Config{
		Region: "us-east-1", // Default region
		UseSSL: true,        // Default to HTTPS
	}

	// Required fields
	if endpoint, ok := data["endpoint"].(string); ok && endpoint != "" {
		cfg.Endpoint = endpoint
	} else {
		return nil, errors.New("s3 endpoint is required")
	}

	if bucket, ok := data["bucket"].(string); ok && bucket != "" {
		cfg.Bucket = bucket
	} else {
		return nil, errors.New("s3 bucket is required")
	}

	if accessKeyID, ok := data["accessKeyId"].(string); ok && accessKeyID != "" {
		cfg.AccessKeyID = accessKeyID
	} else {
		return nil, errors.New("s3 accessKeyId is required")
	}

	if secretAccessKey, ok := data["secretAccessKey"].(string); ok && secretAccessKey != "" {
		cfg.SecretAccessKey = secretAccessKey
	} else {
		return nil, errors.New("s3 secretAccessKey is required")
	}

	// Optional fields
	if region, ok := data["region"].(string); ok && region != "" {
		cfg.Region = region
	}

	if forcePathStyle, ok := data["forcePathStyle"].(bool); ok {
		cfg.ForcePathStyle = forcePathStyle
	}

	if useSSL, ok := data["useSSL"].(bool); ok {
		cfg.UseSSL = useSSL
	}

	return cfg, nil
}

// ValidateConfig validates the S3 configuration.
func ValidateConfig(cfg *Config) error {
	if cfg == nil {
		return errors.New("s3 config is nil")
	}

	if cfg.Endpoint == "" {
		return errors.New("s3 endpoint is required")
	}

	if cfg.Bucket == "" {
		return errors.New("s3 bucket is required")
	}

	if cfg.AccessKeyID == "" {
		return errors.New("s3 accessKeyId is required")
	}

	if cfg.SecretAccessKey == "" {
		return errors.New("s3 secretAccessKey is required")
	}

	return nil
}

// ToMap converts Config to a map for storage in JSON fields.
func (c *Config) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"endpoint":        c.Endpoint,
		"bucket":          c.Bucket,
		"accessKeyId":     c.AccessKeyID,
		"secretAccessKey": c.SecretAccessKey,
		"region":          c.Region,
		"forcePathStyle":  c.ForcePathStyle,
		"useSSL":          c.UseSSL,
	}
}

// DataKey returns the S3 object key for runner data.
// Format: runners/data/{runnerID}.tar.gz
func DataKey(runnerID string) string {
	return fmt.Sprintf("runners/data/%s.tar.gz", runnerID)
}
