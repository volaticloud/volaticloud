package monitor

import (
	"context"
	"fmt"
	"io"
	"log"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"

	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

const (
	// FreqtradeDataVolume is the Docker volume name for historical data
	FreqtradeDataVolume = "volaticloud-freqtrade-data"

	// FreqtradeImage is the Docker image to use for data download
	FreqtradeImage = "freqtradeorg/freqtrade:stable"

	// DataDownloadContainerPrefix is the prefix for data download container names
	DataDownloadContainerPrefix = "volaticloud-data-download"
)

// GetDataDownloadContainerName returns the deterministic container name for a runner's data download
func GetDataDownloadContainerName(runnerID string, exchange string) string {
	return fmt.Sprintf("%s-%s-%s", DataDownloadContainerPrefix, runnerID, exchange)
}

// CheckDownloadContainerStatus checks if a download container exists and returns its status
// Returns: running (bool), exists (bool), error
func CheckDownloadContainerStatus(ctx context.Context, cli *client.Client, containerName string) (running bool, exists bool, err error) {
	info, err := cli.ContainerInspect(ctx, containerName)
	if err != nil {
		if client.IsErrNotFound(err) {
			return false, false, nil
		}
		return false, false, err
	}
	return info.State.Running, true, nil
}

// removeContainerIfExists stops and removes a container if it exists
// This is used to clean up any leftover containers from previous failed/stuck downloads
func removeContainerIfExists(ctx context.Context, cli *client.Client, containerName string) error {
	// Check if container exists
	info, err := cli.ContainerInspect(ctx, containerName)
	if err != nil {
		if client.IsErrNotFound(err) {
			// Container doesn't exist, nothing to do
			return nil
		}
		return fmt.Errorf("failed to inspect container: %w", err)
	}

	// If container is running, stop it first
	if info.State.Running {
		log.Printf("Stopping existing container %s", containerName)
		timeout := 10 // seconds
		if err := cli.ContainerStop(ctx, containerName, container.StopOptions{Timeout: &timeout}); err != nil {
			log.Printf("Warning: failed to stop container %s: %v", containerName, err)
		}
	}

	// Remove the container
	log.Printf("Removing existing container %s", containerName)
	if err := cli.ContainerRemove(ctx, containerName, container.RemoveOptions{Force: true}); err != nil {
		return fmt.Errorf("failed to remove container: %w", err)
	}

	return nil
}

// DownloadRunnerData downloads historical data for a runner
func DownloadRunnerData(ctx context.Context, dbClient *ent.Client, r *ent.BotRunner) error {
	log.Printf("Runner %s: starting data download", r.Name)

	// Only Docker runners supported for now
	if r.Type != enum.RunnerDocker {
		return fmt.Errorf("only Docker runners are supported for data download, got: %s", r.Type)
	}

	// Check if data download config is provided
	if len(r.DataDownloadConfig) == 0 {
		return fmt.Errorf("runner %s has no data download configuration", r.Name)
	}

	// Parse config
	exchangesRaw, ok := r.DataDownloadConfig["exchanges"]
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
		return fmt.Errorf("runner %s has no enabled exchanges in configuration", r.Name)
	}

	// Create runtime client
	factory := runner.NewFactory()
	rt, err := factory.Create(ctx, r.Type, r.Config)
	if err != nil {
		return fmt.Errorf("failed to create runtime: %w", err)
	}
	defer func() {
		if err := rt.Close(); err != nil {
			log.Printf("Warning: failed to close runtime: %v", err)
		}
	}()

	// Get Docker client from runtime (already configured with remote host)
	dockerRT, ok := rt.(*runner.DockerRuntime)
	if !ok {
		return fmt.Errorf("runtime is not a Docker runtime")
	}

	// Get the Docker client configured for the remote host
	cli := dockerRT.GetClient()

	// Ensure Docker volume exists for data storage
	if err := ensureDataVolume(ctx, cli); err != nil {
		return fmt.Errorf("failed to ensure data volume: %w", err)
	}

	// Download data for each enabled exchange
	for idx, exchConfig := range enabledExchanges {
		exchangeName, ok := exchConfig["name"].(string)
		if !ok {
			log.Printf("Warning: exchange name is not a string, skipping")
			continue
		}
		log.Printf("Runner %s: downloading %s data (%d/%d)", r.Name, exchangeName, idx+1, len(enabledExchanges))

		// Update progress
		progress := map[string]interface{}{
			"pairs_completed":  idx,
			"pairs_total":      len(enabledExchanges),
			"current_pair":     exchangeName,
			"percent_complete": float64(idx) / float64(len(enabledExchanges)) * 100,
		}
		if _, err := dbClient.BotRunner.UpdateOne(r).
			SetDataDownloadProgress(progress).
			Save(context.Background()); err != nil {
			log.Printf("Warning: failed to update runner progress: %v", err)
		}

		if err := downloadExchangeData(ctx, cli, r.ID.String(), exchangeName, exchConfig); err != nil {
			return fmt.Errorf("failed to download %s data: %w", exchangeName, err)
		}
	}

	log.Printf("Runner %s: data download completed", r.Name)
	return nil
}

// downloadExchangeData downloads data for a specific exchange using its configuration
func downloadExchangeData(ctx context.Context, cli *client.Client, runnerID string, exchange string, config map[string]interface{}) error {

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
		} else {
			log.Printf("Warning: skipping non-string timeframe: %v", tf)
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
		days = "365" // Default fallback
	}

	// Get trading mode (default to spot, accepts any string value)
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

	// Add timeframes
	args = append(args, "--timeframes")
	args = append(args, timeframes...)

	log.Printf("Downloading %s: pairs=%s, timeframes=%v, days=%s, mode=%s",
		exchange, pairsPattern, timeframes, days, tradingMode)

	// Run the download container with deterministic name based on runner ID and exchange
	containerName := GetDataDownloadContainerName(runnerID, exchange)

	if err := runFreqtradeCommand(ctx, cli, containerName, args); err != nil {
		return fmt.Errorf("failed to run freqtrade download command: %w", err)
	}

	return nil
}

// runFreqtradeCommand runs a freqtrade command in a Docker container
func runFreqtradeCommand(ctx context.Context, cli *client.Client, containerName string, args []string) error {

	// Pull image if needed
	log.Printf("Pulling Freqtrade image: %s", FreqtradeImage)
	if err := pullImage(ctx, cli, FreqtradeImage); err != nil {
		return fmt.Errorf("failed to pull image: %w", err)
	}

	// Remove existing container if it exists (from previous failed/stuck download)
	if err := removeContainerIfExists(ctx, cli, containerName); err != nil {
		log.Printf("Warning: failed to remove existing container %s: %v", containerName, err)
	}

	// Create container config
	config := &container.Config{
		Image: FreqtradeImage,
		Cmd:   args,
	}

	hostConfig := &container.HostConfig{
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeVolume,
				Source: FreqtradeDataVolume,
				Target: "/freqtrade/user_data/data",
			},
		},
		AutoRemove: true, // Auto-remove container after completion
	}

	// Create container
	resp, err := cli.ContainerCreate(ctx, config, hostConfig, nil, nil, containerName)
	if err != nil {
		return fmt.Errorf("failed to create container: %w", err)
	}

	// Start container
	if err := cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return fmt.Errorf("failed to start container: %w", err)
	}

	log.Printf("Started data download container: %s", resp.ID[:12])

	// Wait for container to finish
	statusCh, errCh := cli.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("error waiting for container: %w", err)
		}
	case status := <-statusCh:
		if status.StatusCode != 0 {
			// Get container logs for error details
			logs, logErr := getContainerLogs(ctx, cli, resp.ID)
			if logErr != nil {
				log.Printf("Warning: failed to get container logs: %v", logErr)
				return fmt.Errorf("container exited with status %d", status.StatusCode)
			}
			return fmt.Errorf("container exited with status %d: %s", status.StatusCode, logs)
		}
		log.Printf("Data download container completed successfully")
	case <-ctx.Done():
		return ctx.Err()
	}

	return nil
}

// pullImage pulls a Docker image if not already present
func pullImage(ctx context.Context, cli *client.Client, imageName string) error {
	// Check if image exists
	_, err := cli.ImageInspect(ctx, imageName)
	if err == nil {
		log.Printf("Image %s already exists", imageName)
		return nil
	}

	// Pull image
	reader, err := cli.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		return err
	}
	defer func() {
		if err := reader.Close(); err != nil {
			log.Printf("Warning: failed to close image pull reader: %v", err)
		}
	}()

	// Wait for pull to complete
	// In production, you might want to show progress
	_, err = io.ReadAll(reader)
	return err
}

// getContainerLogs retrieves logs from a container
func getContainerLogs(ctx context.Context, cli *client.Client, containerID string) (string, error) {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       "50", // Last 50 lines
	}

	reader, err := cli.ContainerLogs(ctx, containerID, options)
	if err != nil {
		return "", err
	}
	defer func() {
		if err := reader.Close(); err != nil {
			log.Printf("Warning: failed to close container logs reader: %v", err)
		}
	}()

	logs, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	return string(logs), nil
}

// ensureDataVolume ensures the Docker volume for data storage exists
func ensureDataVolume(ctx context.Context, cli *client.Client) error {
	log.Printf("Ensuring Docker volume exists: %s", FreqtradeDataVolume)

	// Check if volume exists
	_, err := cli.VolumeInspect(ctx, FreqtradeDataVolume)
	if err == nil {
		log.Printf("Volume %s already exists", FreqtradeDataVolume)
		return nil
	}

	// Create volume if it doesn't exist
	_, err = cli.VolumeCreate(ctx, volume.CreateOptions{
		Name: FreqtradeDataVolume,
		Labels: map[string]string{
			"volaticloud.managed": "true",
			"volaticloud.purpose": "freqtrade-data",
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create volume: %w", err)
	}

	log.Printf("Created Docker volume: %s", FreqtradeDataVolume)
	return nil
}
