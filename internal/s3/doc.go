// Package s3 provides S3-compatible object storage operations for runner data.
//
// # Overview
//
// This package wraps the minio-go client to provide a simple interface for
// uploading, downloading, and managing runner data in S3-compatible storage.
// It supports AWS S3, MinIO, Backblaze B2, and other S3-compatible services.
//
// # Architecture
//
// Runner data is stored in S3 with the following structure:
//
//	s3://{bucket}/runners/data/{runnerID}.zip
//
// Each runner has its own S3 configuration (endpoint, bucket, credentials),
// allowing flexible deployment across different storage providers.
//
// # Data Flow
//
// ```mermaid
// sequenceDiagram
//
//	participant RM as RunnerMonitor
//	participant FT as Freqtrade (local)
//	participant S3 as S3 Storage
//	participant Bot as Bot Container
//
//	Note over RM: Data Preparation (Control Plane)
//	RM->>FT: Run download-data command
//	FT-->>RM: Downloaded OHLCV data
//	RM->>RM: Zip data files
//	RM->>S3: Upload runners/data/{runnerId}.zip
//	RM->>RM: Set dataIsReady = true
//
//	Note over Bot: Bot/Backtest Startup
//	RM->>Bot: Provide presigned S3 URL
//	Bot->>S3: Download via presigned URL
//	S3-->>Bot: Zipped data
//	Bot->>Bot: Extract to user_data/data
//	Bot->>Bot: Run freqtrade trade/backtest
//
// ```
//
// # Usage
//
// Create a client from configuration:
//
//	cfg := &s3.Config{
//	    Endpoint:        "s3.amazonaws.com",
//	    Bucket:          "my-bucket",
//	    AccessKeyID:     "AKIAIOSFODNN7EXAMPLE",
//	    SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
//	    Region:          "us-east-1",
//	    UseSSL:          true,
//	}
//	client, err := s3.NewClient(cfg)
//
// Or from a map (GraphQL input):
//
//	data := map[string]interface{}{
//	    "endpoint":        "s3.amazonaws.com",
//	    "bucket":          "my-bucket",
//	    "accessKeyId":     "...",
//	    "secretAccessKey": "...",
//	}
//	client, err := s3.NewClientFromMap(data)
//
// Upload data:
//
//	file, _ := os.Open("data.zip")
//	defer file.Close()
//	stat, _ := file.Stat()
//	err := client.UploadData(ctx, runnerID, file, stat.Size())
//
// Generate presigned URL (24-hour expiry):
//
//	url, err := client.GetPresignedURL(ctx, runnerID, 24*time.Hour)
//	// url can be used with wget/curl without credentials
//
// # Security
//
// Presigned URLs provide secure, time-limited access to data without exposing
// S3 credentials. URLs are generated server-side and passed to containers via
// environment variables.
package s3
