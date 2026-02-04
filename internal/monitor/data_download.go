package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
	"volaticloud/internal/pubsub"
	"volaticloud/internal/runner"
	"volaticloud/internal/s3"
)

const (
	// FreqtradeImage is the Docker image to use for data download
	FreqtradeImage = "freqtradeorg/freqtrade:stable"

	// PresignedURLExpiry is how long presigned URLs are valid for
	PresignedURLExpiry = 1 * time.Hour
)

// DownloadRunnerData downloads historical data for a runner using the runner's infrastructure.
// Data is downloaded on the runner (Docker host or K8s cluster) and uploaded to S3.
// If ps is provided, progress events will be published for real-time updates.
func DownloadRunnerData(ctx context.Context, dbClient *ent.Client, r *ent.BotRunner, ps pubsub.PubSub) error {
	log.Printf("Runner %s: starting remote data download", r.Name)

	// Validate S3 config
	if len(r.S3Config) == 0 {
		return fmt.Errorf("runner %s has no S3 configuration", r.Name)
	}

	// Create S3 client
	s3Client, err := s3.NewClientFromMap(r.S3Config)
	if err != nil {
		return fmt.Errorf("failed to create S3 client: %w", err)
	}

	// Generate presigned upload URL
	uploadURL, err := s3Client.GetPresignedUploadURL(ctx, r.ID.String(), PresignedURLExpiry)
	if err != nil {
		return fmt.Errorf("failed to generate upload URL: %w", err)
	}

	// Generate presigned download URL for existing data (if any)
	var existingDataURL string
	if r.S3DataKey != "" {
		existingDataURL, err = s3Client.GetPresignedURL(ctx, r.ID.String(), PresignedURLExpiry)
		if err != nil {
			log.Printf("Runner %s: failed to generate existing data URL (will download from scratch): %v", r.Name, err)
			existingDataURL = ""
		}
	}

	// Parse exchange configurations
	exchangeConfigs, err := parseExchangeConfigs(r.DataDownloadConfig)
	if err != nil {
		return fmt.Errorf("failed to parse exchange configs: %w", err)
	}

	// Create DataDownloader spec
	spec := runner.DataDownloadSpec{
		RunnerID:        r.ID.String(),
		ExistingDataURL: existingDataURL,
		UploadURL:       uploadURL,
		FreqtradeImage:  FreqtradeImage,
		ExchangeConfigs: exchangeConfigs,
	}

	// Create DataDownloader using factory
	factory := runner.NewFactory()
	downloader, err := factory.CreateDataDownloader(ctx, r.Type, r.Config)
	if err != nil {
		return fmt.Errorf("failed to create data downloader: %w", err)
	}

	// Start download task
	taskID, err := downloader.StartDownload(ctx, spec)
	if err != nil {
		return fmt.Errorf("failed to start download: %w", err)
	}

	log.Printf("Runner %s: started remote download task %s", r.Name, taskID)

	// Wait for completion (polling)
	// The context carries the timeout deadline set by the caller
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			// Context cancelled or deadline exceeded - try to cancel the download
			if cancelErr := downloader.CancelDownload(context.Background(), taskID); cancelErr != nil {
				log.Printf("Runner %s: failed to cancel download: %v", r.Name, cancelErr)
			}
			return fmt.Errorf("download cancelled or timed out: %w", ctx.Err())

		case <-ticker.C:
			status, err := downloader.GetDownloadStatus(ctx, taskID)
			if err != nil {
				log.Printf("Runner %s: failed to get download status: %v", r.Name, err)
				continue
			}

			// Update progress in database
			progress := map[string]interface{}{
				"task_id":          taskID,
				"current_phase":    status.CurrentPhase,
				"percent_complete": status.Progress,
			}
			if _, updateErr := dbClient.BotRunner.UpdateOne(r).
				SetDataDownloadProgress(progress).
				Save(ctx); updateErr != nil {
				log.Printf("Runner %s: failed to update progress: %v", r.Name, updateErr)
			}

			// Publish progress event for real-time UI updates
			if ps != nil {
				event := pubsub.RunnerEvent{
					Type:      pubsub.EventTypeRunnerProgress,
					RunnerID:  r.ID.String(),
					Status:    string(enum.DataDownloadStatusDownloading),
					Progress:  status.Progress,
					Timestamp: time.Now(),
				}
				// Publish to runner-specific topic
				if pubErr := ps.Publish(ctx, pubsub.RunnerTopic(r.ID.String()), event); pubErr != nil {
					log.Printf("Runner %s: failed to publish progress event: %v", r.Name, pubErr)
				}
				// Publish to org-level topic for list views
				if pubErr := ps.Publish(ctx, pubsub.OrgRunnersTopic(r.OwnerID), event); pubErr != nil {
					log.Printf("Runner %s: failed to publish org progress event: %v", r.Name, pubErr)
				}
			}

			switch status.Status {
			case enum.DataDownloadStatusCompleted:
				log.Printf("Runner %s: remote download completed", r.Name)

				// Get logs to extract data availability metadata
				logs, logErr := downloader.GetDownloadLogs(ctx, taskID)
				if logErr != nil {
					log.Printf("Runner %s: failed to get download logs: %v", r.Name, logErr)
				}
				dataAvailable := parseDataAvailableFromLogs(logs)
				if dataAvailable != nil {
					log.Printf("Runner %s: extracted data availability metadata", r.Name)
				}

				// Cleanup download task
				if cleanupErr := downloader.CleanupDownload(ctx, taskID); cleanupErr != nil {
					log.Printf("Runner %s: failed to cleanup download task: %v", r.Name, cleanupErr)
				}

				// Update S3 data key and data availability
				now := time.Now()
				s3DataKey := s3.DataKey(r.ID.String())
				update := dbClient.BotRunner.UpdateOne(r).
					SetS3DataKey(s3DataKey).
					SetS3DataUploadedAt(now)
				if dataAvailable != nil {
					update = update.SetDataAvailable(dataAvailable)
				}
				if _, updateErr := update.Save(ctx); updateErr != nil {
					log.Printf("Runner %s: failed to update S3 info: %v", r.Name, updateErr)
				}
				return nil

			case enum.DataDownloadStatusFailed:
				// Get logs for debugging
				logs, logErr := downloader.GetDownloadLogs(ctx, taskID)
				if logErr != nil {
					log.Printf("Runner %s: failed to get download logs: %v", r.Name, logErr)
				} else if logs != "" {
					log.Printf("Runner %s: download logs: %s", r.Name, logs)
				}
				// Cleanup download task
				if cleanupErr := downloader.CleanupDownload(ctx, taskID); cleanupErr != nil {
					log.Printf("Runner %s: failed to cleanup failed download task: %v", r.Name, cleanupErr)
				}
				return fmt.Errorf("download failed: %s", status.ErrorMessage)

			default:
				log.Printf("Runner %s: download status: %s (%.0f%%)", r.Name, status.CurrentPhase, status.Progress)
			}
		}
	}
}

// parseDataAvailableFromLogs extracts data availability metadata from download logs.
// The script outputs metadata between ===DATA_AVAILABLE_START=== and ===DATA_AVAILABLE_END=== markers.
func parseDataAvailableFromLogs(logs string) map[string]interface{} {
	const startMarker = "===DATA_AVAILABLE_START==="
	const endMarker = "===DATA_AVAILABLE_END==="

	startIdx := strings.Index(logs, startMarker)
	if startIdx == -1 {
		return nil
	}
	startIdx += len(startMarker)

	endIdx := strings.Index(logs[startIdx:], endMarker)
	if endIdx == -1 {
		return nil
	}

	jsonStr := strings.TrimSpace(logs[startIdx : startIdx+endIdx])
	if jsonStr == "" {
		return nil
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		log.Printf("Failed to parse data availability JSON: %v", err)
		return nil
	}

	return result
}

// parseExchangeConfigs parses the data download config into exchange configs.
func parseExchangeConfigs(config map[string]interface{}) ([]runner.ExchangeDownloadConfig, error) {
	exchangesRaw, ok := config["exchanges"]
	if !ok {
		return nil, fmt.Errorf("data_download_config missing 'exchanges' field")
	}

	exchanges, ok := exchangesRaw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("data_download_config.exchanges must be an array")
	}

	var result []runner.ExchangeDownloadConfig
	for _, exchRaw := range exchanges {
		exch, ok := exchRaw.(map[string]interface{})
		if !ok {
			continue
		}

		enabled, ok := exch["enabled"].(bool)
		if !ok || !enabled {
			continue
		}

		name, ok := exch["name"].(string)
		if !ok {
			continue
		}

		pairsPattern, _ := exch["pairsPattern"].(string)

		// Parse timeframes
		var timeframes []string
		if tfRaw, ok := exch["timeframes"].([]interface{}); ok {
			for _, tf := range tfRaw {
				if tfStr, ok := tf.(string); ok {
					timeframes = append(timeframes, tfStr)
				}
			}
		}

		// Parse days
		days := 365
		switch v := exch["days"].(type) {
		case int:
			days = v
		case float64:
			days = int(v)
		}

		// Parse trading mode
		tradingMode := "spot"
		if tm, ok := exch["tradingMode"].(string); ok {
			tradingMode = tm
		}

		result = append(result, runner.ExchangeDownloadConfig{
			Name:         name,
			PairsPattern: pairsPattern,
			Timeframes:   timeframes,
			Days:         days,
			TradingMode:  tradingMode,
		})
	}

	if len(result) == 0 {
		return nil, fmt.Errorf("no enabled exchanges in configuration")
	}

	return result, nil
}
