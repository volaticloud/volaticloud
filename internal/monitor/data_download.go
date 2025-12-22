package monitor

import (
	"context"
	"log"
	"os"

	"volaticloud/internal/ent"
)

const (
	// FreqtradeImage is the Docker image to use for data download
	FreqtradeImage = "freqtradeorg/freqtrade:stable"

	// DefaultLocalDownloadWorkDir is the default directory for local data downloads
	DefaultLocalDownloadWorkDir = "/tmp/volaticloud-data-downloads"
)

// DownloadRunnerData downloads historical data for a runner and uploads to S3.
// Data is downloaded locally on the control plane and uploaded to the runner's S3 bucket.
func DownloadRunnerData(ctx context.Context, dbClient *ent.Client, r *ent.BotRunner) error {
	log.Printf("Runner %s: starting data download with S3", r.Name)

	// Get work directory from environment or use default
	workDir := os.Getenv("VOLATICLOUD_DATA_DOWNLOAD_DIR")
	if workDir == "" {
		workDir = DefaultLocalDownloadWorkDir
	}

	// Create local downloader
	downloader, err := NewLocalDataDownloader(workDir, "")
	if err != nil {
		return err
	}
	defer downloader.Close()

	// Download data and upload to S3
	return downloader.DownloadAndUpload(ctx, dbClient, r)
}
