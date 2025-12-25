package s3

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Client wraps minio-go client for S3 operations.
type Client struct {
	mc     *minio.Client
	bucket string
}

// NewClient creates a new S3 client from configuration.
func NewClient(cfg *Config) (*Client, error) {
	if err := ValidateConfig(cfg); err != nil {
		return nil, fmt.Errorf("invalid s3 config: %w", err)
	}

	mc, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}

	return &Client{
		mc:     mc,
		bucket: cfg.Bucket,
	}, nil
}

// NewClientFromMap creates a new S3 client from a map configuration.
func NewClientFromMap(data map[string]interface{}) (*Client, error) {
	cfg, err := ParseConfig(data)
	if err != nil {
		return nil, err
	}
	return NewClient(cfg)
}

// UploadData uploads runner data to S3.
// The data is stored at: runners/data/{runnerID}.tar.gz
func (c *Client) UploadData(ctx context.Context, runnerID string, reader io.Reader, size int64) error {
	key := DataKey(runnerID)

	opts := minio.PutObjectOptions{
		ContentType: "application/gzip",
	}

	_, err := c.mc.PutObject(ctx, c.bucket, key, reader, size, opts)
	if err != nil {
		return fmt.Errorf("failed to upload data to s3://%s/%s: %w", c.bucket, key, err)
	}

	return nil
}

// DownloadData downloads runner data from S3.
// Caller is responsible for closing the returned reader.
func (c *Client) DownloadData(ctx context.Context, runnerID string) (io.ReadCloser, error) {
	key := DataKey(runnerID)

	obj, err := c.mc.GetObject(ctx, c.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to download data from s3://%s/%s: %w", c.bucket, key, err)
	}

	return obj, nil
}

// GetPresignedURL generates a presigned URL for downloading runner data.
// The URL is valid for the specified duration (max 7 days for AWS S3).
func (c *Client) GetPresignedURL(ctx context.Context, runnerID string, expiry time.Duration) (string, error) {
	key := DataKey(runnerID)

	// Set request parameters for content disposition
	reqParams := make(url.Values)
	reqParams.Set("response-content-disposition", fmt.Sprintf("attachment; filename=\"%s.tar.gz\"", runnerID))

	presignedURL, err := c.mc.PresignedGetObject(ctx, c.bucket, key, expiry, reqParams)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL for s3://%s/%s: %w", c.bucket, key, err)
	}

	return presignedURL.String(), nil
}

// GetPresignedUploadURL generates a presigned URL for uploading runner data.
// This URL can be used by remote containers/jobs to upload data directly to S3
// without having S3 credentials. The URL is valid for the specified duration.
func (c *Client) GetPresignedUploadURL(ctx context.Context, runnerID string, expiry time.Duration) (string, error) {
	key := DataKey(runnerID)

	presignedURL, err := c.mc.PresignedPutObject(ctx, c.bucket, key, expiry)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned upload URL for s3://%s/%s: %w", c.bucket, key, err)
	}

	return presignedURL.String(), nil
}

// DataExists checks if runner data exists in S3.
func (c *Client) DataExists(ctx context.Context, runnerID string) (bool, error) {
	key := DataKey(runnerID)

	_, err := c.mc.StatObject(ctx, c.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		// Check if error is "not found"
		errResp := minio.ToErrorResponse(err)
		if errResp.Code == "NoSuchKey" {
			return false, nil
		}
		return false, fmt.Errorf("failed to check data existence at s3://%s/%s: %w", c.bucket, key, err)
	}

	return true, nil
}

// DeleteData removes runner data from S3.
func (c *Client) DeleteData(ctx context.Context, runnerID string) error {
	key := DataKey(runnerID)

	err := c.mc.RemoveObject(ctx, c.bucket, key, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete data from s3://%s/%s: %w", c.bucket, key, err)
	}

	return nil
}

// GetDataInfo returns metadata about runner data in S3.
func (c *Client) GetDataInfo(ctx context.Context, runnerID string) (*DataInfo, error) {
	key := DataKey(runnerID)

	stat, err := c.mc.StatObject(ctx, c.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		errResp := minio.ToErrorResponse(err)
		if errResp.Code == "NoSuchKey" {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get data info from s3://%s/%s: %w", c.bucket, key, err)
	}

	return &DataInfo{
		Key:          key,
		Size:         stat.Size,
		LastModified: stat.LastModified,
		ETag:         stat.ETag,
	}, nil
}

// DataInfo contains metadata about S3 data object.
type DataInfo struct {
	Key          string
	Size         int64
	LastModified time.Time
	ETag         string
}

// TestConnection tests the S3 connection by checking if the bucket exists.
func (c *Client) TestConnection(ctx context.Context) error {
	exists, err := c.mc.BucketExists(ctx, c.bucket)
	if err != nil {
		return fmt.Errorf("failed to check bucket existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("bucket %q does not exist", c.bucket)
	}
	return nil
}

// EnsureBucket creates the bucket if it doesn't exist.
func (c *Client) EnsureBucket(ctx context.Context, region string) error {
	exists, err := c.mc.BucketExists(ctx, c.bucket)
	if err != nil {
		return fmt.Errorf("failed to check bucket existence: %w", err)
	}

	if !exists {
		err = c.mc.MakeBucket(ctx, c.bucket, minio.MakeBucketOptions{
			Region: region,
		})
		if err != nil {
			return fmt.Errorf("failed to create bucket %q: %w", c.bucket, err)
		}
	}

	return nil
}

// Bucket returns the configured bucket name.
func (c *Client) Bucket() string {
	return c.bucket
}
