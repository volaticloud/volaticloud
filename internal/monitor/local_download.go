package monitor

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"

	"volaticloud/internal/ent"
	"volaticloud/internal/s3"
)

// LocalDataDownloader downloads historical data on the control plane server
// and uploads it to S3 for distribution to bots/backtests.
type LocalDataDownloader struct {
	workDir    string
	dockerHost string // Optional Docker host (empty = local)
	client     *client.Client
}

// NewLocalDataDownloader creates a new local data downloader.
// workDir is the base directory for temporary data storage.
// dockerHost is optional (empty string uses local Docker).
func NewLocalDataDownloader(workDir string, dockerHost string) (*LocalDataDownloader, error) {
	// Create work directory if it doesn't exist
	if err := os.MkdirAll(workDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create work directory: %w", err)
	}

	// Create Docker client
	var opts []client.Opt
	opts = append(opts, client.FromEnv, client.WithAPIVersionNegotiation())
	if dockerHost != "" {
		opts = append(opts, client.WithHost(dockerHost))
	}

	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	return &LocalDataDownloader{
		workDir:    workDir,
		dockerHost: dockerHost,
		client:     cli,
	}, nil
}

// Close releases resources.
func (d *LocalDataDownloader) Close() error {
	if d.client != nil {
		return d.client.Close()
	}
	return nil
}

// DownloadAndUpload downloads data for a runner and uploads it to S3.
// Returns the S3 object key for the uploaded data.
func (d *LocalDataDownloader) DownloadAndUpload(ctx context.Context, dbClient *ent.Client, runner *ent.BotRunner) error {
	runnerID := runner.ID.String()
	log.Printf("Runner %s: starting local data download", runner.Name)

	// Validate S3 config
	if len(runner.S3Config) == 0 {
		return fmt.Errorf("runner %s has no S3 configuration", runner.Name)
	}

	// Create S3 client
	s3Client, err := s3.NewClientFromMap(runner.S3Config)
	if err != nil {
		return fmt.Errorf("failed to create S3 client: %w", err)
	}

	// Create temporary directory for this runner's data
	dataDir := filepath.Join(d.workDir, runnerID, "data")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}
	defer func() {
		// Clean up temporary directory after upload
		if err := os.RemoveAll(filepath.Join(d.workDir, runnerID)); err != nil {
			log.Printf("Warning: failed to clean up temp directory: %v", err)
		}
	}()

	// Parse and validate data download config
	exchangesRaw, ok := runner.DataDownloadConfig["exchanges"]
	if !ok {
		return fmt.Errorf("data_download_config missing 'exchanges' field")
	}

	exchanges, ok := exchangesRaw.([]interface{})
	if !ok {
		return fmt.Errorf("data_download_config.exchanges must be an array")
	}

	// Filter enabled exchanges
	var enabledExchanges []map[string]interface{}
	for _, exchRaw := range exchanges {
		exch, ok := exchRaw.(map[string]interface{})
		if !ok {
			continue
		}
		enabled, ok := exch["enabled"].(bool)
		if ok && enabled {
			enabledExchanges = append(enabledExchanges, exch)
		}
	}

	if len(enabledExchanges) == 0 {
		return fmt.Errorf("runner %s has no enabled exchanges in configuration", runner.Name)
	}

	// Download data for each exchange
	for idx, exchConfig := range enabledExchanges {
		exchangeName, ok := exchConfig["name"].(string)
		if !ok {
			log.Printf("Warning: exchange name is not a string, skipping")
			continue
		}

		log.Printf("Runner %s: downloading %s data (%d/%d)", runner.Name, exchangeName, idx+1, len(enabledExchanges))

		// Update progress in database
		progress := map[string]interface{}{
			"pairs_completed":  idx,
			"pairs_total":      len(enabledExchanges),
			"current_pair":     exchangeName,
			"percent_complete": float64(idx) / float64(len(enabledExchanges)) * 50, // First 50% is download
		}
		if _, err := dbClient.BotRunner.UpdateOne(runner).
			SetDataDownloadProgress(progress).
			Save(context.Background()); err != nil {
			log.Printf("Warning: failed to update runner progress: %v", err)
		}

		if err := d.downloadExchangeDataLocal(ctx, dataDir, exchangeName, exchConfig); err != nil {
			return fmt.Errorf("failed to download %s data: %w", exchangeName, err)
		}
	}

	// Update progress - packaging phase
	progress := map[string]interface{}{
		"pairs_completed":  len(enabledExchanges),
		"pairs_total":      len(enabledExchanges),
		"current_pair":     "packaging",
		"percent_complete": 60.0,
	}
	if _, err := dbClient.BotRunner.UpdateOne(runner).
		SetDataDownloadProgress(progress).
		Save(context.Background()); err != nil {
		log.Printf("Warning: failed to update runner progress: %v", err)
	}

	// Create zip file
	zipPath := filepath.Join(d.workDir, runnerID, "data.zip")
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return fmt.Errorf("failed to create zip file: %w", err)
	}

	log.Printf("Runner %s: packaging data to zip", runner.Name)
	if err := PackData(dataDir, zipFile); err != nil {
		zipFile.Close()
		return fmt.Errorf("failed to pack data: %w", err)
	}
	zipFile.Close()

	// Get zip file info for upload
	zipInfo, err := os.Stat(zipPath)
	if err != nil {
		return fmt.Errorf("failed to stat zip file: %w", err)
	}

	// Update progress - upload phase
	progress = map[string]interface{}{
		"pairs_completed":  len(enabledExchanges),
		"pairs_total":      len(enabledExchanges),
		"current_pair":     "uploading",
		"percent_complete": 80.0,
	}
	if _, err := dbClient.BotRunner.UpdateOne(runner).
		SetDataDownloadProgress(progress).
		Save(context.Background()); err != nil {
		log.Printf("Warning: failed to update runner progress: %v", err)
	}

	// Upload to S3
	log.Printf("Runner %s: uploading data to S3 (%d bytes)", runner.Name, zipInfo.Size())
	zipReader, err := os.Open(zipPath)
	if err != nil {
		return fmt.Errorf("failed to open zip file for upload: %w", err)
	}
	defer zipReader.Close()

	if err := s3Client.UploadData(ctx, runnerID, zipReader, zipInfo.Size()); err != nil {
		return fmt.Errorf("failed to upload to S3: %w", err)
	}

	// Update runner with S3 data key and timestamp
	now := time.Now()
	s3DataKey := s3.DataKey(runnerID)
	if _, err := dbClient.BotRunner.UpdateOne(runner).
		SetS3DataKey(s3DataKey).
		SetS3DataUploadedAt(now).
		Save(context.Background()); err != nil {
		log.Printf("Warning: failed to update runner S3 info: %v", err)
	}

	log.Printf("Runner %s: data uploaded to S3 successfully", runner.Name)
	return nil
}

// downloadExchangeDataLocal downloads data for a specific exchange to a local directory.
func (d *LocalDataDownloader) downloadExchangeDataLocal(ctx context.Context, dataDir string, exchange string, config map[string]interface{}) error {
	// Extract configuration (using camelCase field names from GraphQL)
	pairsPattern, ok := config["pairsPattern"].(string)
	if !ok {
		return fmt.Errorf("pairsPattern is not a string")
	}

	// Get timeframes
	timeframesRaw, ok := config["timeframes"].([]interface{})
	if !ok {
		return fmt.Errorf("timeframes is not an array")
	}
	timeframes := make([]string, 0, len(timeframesRaw))
	for _, tf := range timeframesRaw {
		if tfStr, ok := tf.(string); ok {
			timeframes = append(timeframes, tfStr)
		}
	}

	// Get days
	var days string
	switch v := config["days"].(type) {
	case int:
		days = fmt.Sprintf("%d", v)
	case float64:
		days = fmt.Sprintf("%d", int(v))
	default:
		days = "365"
	}

	// Get trading mode
	tradingMode := "spot"
	if tm, ok := config["tradingMode"].(string); ok {
		tradingMode = tm
	}

	// Build freqtrade download-data command
	args := []string{
		"download-data",
		"--exchange", exchange,
		"--pairs", pairsPattern,
		"--days", days,
		"--data-format-ohlcv", "json",
		"--trading-mode", tradingMode,
	}
	args = append(args, "--timeframes")
	args = append(args, timeframes...)

	log.Printf("Downloading %s locally: pairs=%s, timeframes=%v, days=%s, mode=%s",
		exchange, pairsPattern, timeframes, days, tradingMode)

	// Ensure freqtrade image is available
	if err := d.pullImage(ctx, FreqtradeImage); err != nil {
		return fmt.Errorf("failed to pull image: %w", err)
	}

	// Create container
	containerName := fmt.Sprintf("volaticloud-local-download-%d", time.Now().UnixNano())

	containerConfig := &container.Config{
		Image: FreqtradeImage,
		Cmd:   args,
	}

	hostConfig := &container.HostConfig{
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeBind,
				Source: dataDir,
				Target: "/freqtrade/user_data/data",
			},
		},
		AutoRemove: true,
	}

	resp, err := d.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, containerName)
	if err != nil {
		return fmt.Errorf("failed to create container: %w", err)
	}

	// Start container
	if err := d.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return fmt.Errorf("failed to start container: %w", err)
	}

	log.Printf("Started local download container: %s", resp.ID[:12])

	// Wait for container to finish
	statusCh, errCh := d.client.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("error waiting for container: %w", err)
		}
	case status := <-statusCh:
		if status.StatusCode != 0 {
			logs, logErr := d.getContainerLogs(ctx, resp.ID)
			if logErr != nil {
				log.Printf("Warning: failed to get container logs: %v", logErr)
				return fmt.Errorf("container exited with status %d", status.StatusCode)
			}
			return fmt.Errorf("container exited with status %d: %s", status.StatusCode, logs)
		}
		log.Printf("Local download container completed successfully")
	case <-ctx.Done():
		return ctx.Err()
	}

	return nil
}

func (d *LocalDataDownloader) pullImage(ctx context.Context, imageName string) error {
	// Check if image exists
	_, err := d.client.ImageInspect(ctx, imageName)
	if err == nil {
		return nil
	}

	// Pull image
	log.Printf("Pulling image: %s", imageName)
	reader, err := d.client.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()

	// Wait for pull to complete
	_, err = io.ReadAll(reader)
	return err
}

func (d *LocalDataDownloader) getContainerLogs(ctx context.Context, containerID string) (string, error) {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       "50",
	}

	reader, err := d.client.ContainerLogs(ctx, containerID, options)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	logs, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	return string(logs), nil
}

// Cleanup removes all temporary files for a specific runner.
func (d *LocalDataDownloader) Cleanup(runnerID string) error {
	runnerDir := filepath.Join(d.workDir, runnerID)
	return os.RemoveAll(runnerDir)
}

// CleanupAll removes all temporary files.
func (d *LocalDataDownloader) CleanupAll() error {
	return os.RemoveAll(d.workDir)
}
