package docker

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"

	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

// Compile-time interface compliance check
var _ runner.DataDownloader = (*DataDownloader)(nil)

// DataDownloader implements runner.DataDownloader for Docker.
// It runs data download containers on the remote Docker host.
type DataDownloader struct {
	client  *client.Client
	config  *Config
	network string
}

// NewDataDownloader creates a new Docker data downloader.
func NewDataDownloader(ctx context.Context, config *Config) (*DataDownloader, error) {
	var opts []client.Opt
	opts = append(opts, client.FromEnv, client.WithAPIVersionNegotiation())
	if config.Host != "" {
		opts = append(opts, client.WithHost(config.Host))
	}

	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	// Verify connection
	if _, err := cli.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to Docker host: %w", err)
	}

	network := config.Network
	if network == "" {
		network = "bridge"
	}

	return &DataDownloader{
		client:  cli,
		config:  config,
		network: network,
	}, nil
}

// StartDownload starts a data download container on the Docker host.
func (d *DataDownloader) StartDownload(ctx context.Context, spec runner.DataDownloadSpec) (string, error) {
	// Build the download script
	script := buildDownloadScript(spec)

	// Ensure image is available
	if err := d.pullImage(ctx, spec.FreqtradeImage); err != nil {
		return "", fmt.Errorf("failed to pull image: %w", err)
	}

	// Create container name
	containerName := fmt.Sprintf("volaticloud-data-download-%s-%d", spec.RunnerID, time.Now().UnixNano())

	// Build environment variables
	env := []string{
		fmt.Sprintf("UPLOAD_URL=%s", spec.UploadURL),
	}
	if spec.ExistingDataURL != "" {
		env = append(env, fmt.Sprintf("EXISTING_DATA_URL=%s", spec.ExistingDataURL))
	}

	containerConfig := &container.Config{
		Image:      spec.FreqtradeImage,
		Entrypoint: []string{"/bin/sh", "-c"},
		Cmd:        []string{script},
		Env:        env,
		Labels: map[string]string{
			"volaticloud.io/managed":   "true",
			"volaticloud.io/runner-id": spec.RunnerID,
			"volaticloud.io/component": "data-download",
		},
	}

	hostConfig := &container.HostConfig{
		NetworkMode: container.NetworkMode(d.network),
		AutoRemove:  false, // Keep container for log retrieval
	}

	resp, err := d.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, containerName)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	// Start container
	if err := d.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		// Clean up on failure
		_ = d.client.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return "", fmt.Errorf("failed to start container: %w", err)
	}

	log.Printf("Started data download container: %s (runner: %s)", resp.ID[:12], spec.RunnerID)
	return resp.ID, nil
}

// GetDownloadStatus returns the current status of a download container.
func (d *DataDownloader) GetDownloadStatus(ctx context.Context, taskID string) (*runner.DataDownloadStatus, error) {
	info, err := d.client.ContainerInspect(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect container: %w", err)
	}

	status := &runner.DataDownloadStatus{
		TaskID: taskID,
	}

	// Parse container state
	switch {
	case info.State.Running:
		status.Status = enum.DataDownloadStatusDownloading
		status.CurrentPhase = "downloading"
		if info.State.StartedAt != "" {
			startedAt, _ := time.Parse(time.RFC3339Nano, info.State.StartedAt)
			status.StartedAt = &startedAt
		}

	case info.State.Status == "exited":
		if info.State.FinishedAt != "" {
			completedAt, _ := time.Parse(time.RFC3339Nano, info.State.FinishedAt)
			status.CompletedAt = &completedAt
		}
		if info.State.StartedAt != "" {
			startedAt, _ := time.Parse(time.RFC3339Nano, info.State.StartedAt)
			status.StartedAt = &startedAt
		}

		if info.State.ExitCode == 0 {
			status.Status = enum.DataDownloadStatusCompleted
			status.Progress = 100
			status.CurrentPhase = "completed"
		} else {
			status.Status = enum.DataDownloadStatusFailed
			status.ErrorMessage = fmt.Sprintf("container exited with code %d", info.State.ExitCode)
			status.CurrentPhase = "failed"
		}

	case info.State.Status == "created":
		status.Status = enum.DataDownloadStatusPending
		status.CurrentPhase = "pending"

	default:
		status.Status = enum.DataDownloadStatusFailed
		status.ErrorMessage = fmt.Sprintf("unexpected container state: %s", info.State.Status)
	}

	return status, nil
}

// GetDownloadLogs returns logs from a download container.
// Docker logs are multiplexed with 8-byte headers, so we use stdcopy to demux.
func (d *DataDownloader) GetDownloadLogs(ctx context.Context, taskID string) (string, error) {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       "500", // Increased to ensure we capture the metadata markers
	}

	reader, err := d.client.ContainerLogs(ctx, taskID, options)
	if err != nil {
		return "", fmt.Errorf("failed to get container logs: %w", err)
	}
	defer reader.Close()

	// Docker logs are multiplexed - demultiplex stdout and stderr
	var stdout, stderr bytes.Buffer
	_, err = stdcopy.StdCopy(&stdout, &stderr, reader)
	if err != nil {
		// If stdcopy fails, try reading raw (container might use TTY mode)
		rawReader, rawErr := d.client.ContainerLogs(ctx, taskID, options)
		if rawErr != nil {
			return "", fmt.Errorf("failed to get container logs: %w", rawErr)
		}
		defer rawReader.Close()
		raw, _ := io.ReadAll(rawReader)
		return string(raw), nil
	}

	// Combine stdout and stderr (metadata is on stdout)
	return stdout.String() + stderr.String(), nil
}

// CancelDownload stops a running download container.
func (d *DataDownloader) CancelDownload(ctx context.Context, taskID string) error {
	timeout := 10 // seconds
	if err := d.client.ContainerStop(ctx, taskID, container.StopOptions{Timeout: &timeout}); err != nil {
		return fmt.Errorf("failed to stop container: %w", err)
	}
	return nil
}

// CleanupDownload removes the download container.
func (d *DataDownloader) CleanupDownload(ctx context.Context, taskID string) error {
	if err := d.client.ContainerRemove(ctx, taskID, container.RemoveOptions{Force: true}); err != nil {
		return fmt.Errorf("failed to remove container: %w", err)
	}
	return nil
}

// pullImage ensures the image is available locally.
func (d *DataDownloader) pullImage(ctx context.Context, imageName string) error {
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

// buildDownloadScript creates the shell script for data download.
// Uses Python (available in freqtrade image) for S3 operations.
func buildDownloadScript(spec runner.DataDownloadSpec) string {
	var sb strings.Builder

	sb.WriteString("set -e\n")
	sb.WriteString("cd /tmp\n\n")

	// Setup user_data directory structure
	sb.WriteString("# Setup user_data directory\n")
	sb.WriteString("mkdir -p /freqtrade/user_data/data\n\n")

	// Phase 1: Download existing data for incremental update
	sb.WriteString("# Phase 1: Download existing data for incremental update\n")
	sb.WriteString("if [ -n \"$EXISTING_DATA_URL\" ]; then\n")
	sb.WriteString("    echo \"Downloading existing data for incremental update...\"\n")
	sb.WriteString("    python3 -c \"\n")
	sb.WriteString("import urllib.request\n")
	sb.WriteString("import os\n")
	sb.WriteString("url = os.environ.get('EXISTING_DATA_URL', '')\n")
	sb.WriteString("if url:\n")
	sb.WriteString("    try:\n")
	sb.WriteString("        urllib.request.urlretrieve(url, '/tmp/existing.tar.gz')\n")
	sb.WriteString("        print('Downloaded existing data')\n")
	sb.WriteString("    except Exception as e:\n")
	sb.WriteString("        print(f'No existing data available: {e}')\n")
	sb.WriteString("\" || true\n")
	sb.WriteString("    if [ -f existing.tar.gz ]; then\n")
	sb.WriteString("        tar -xzf existing.tar.gz -C /freqtrade/user_data/data\n")
	sb.WriteString("        rm existing.tar.gz\n")
	sb.WriteString("        echo \"Existing data extracted successfully\"\n")
	sb.WriteString("    fi\n")
	sb.WriteString("fi\n\n")

	// Phase 2: Download new data for each exchange
	sb.WriteString("# Phase 2: Download new data for each exchange\n")
	for _, exch := range spec.ExchangeConfigs {
		sb.WriteString(fmt.Sprintf("echo \"Downloading %s data...\"\n", exch.Name))
		sb.WriteString("freqtrade download-data \\\n")
		sb.WriteString("    --userdir /freqtrade/user_data \\\n")
		sb.WriteString(fmt.Sprintf("    --exchange %s \\\n", exch.Name))
		sb.WriteString(fmt.Sprintf("    --pairs \"%s\" \\\n", exch.PairsPattern))
		sb.WriteString(fmt.Sprintf("    --timeframes %s \\\n", strings.Join(exch.Timeframes, " ")))
		sb.WriteString(fmt.Sprintf("    --days %d \\\n", exch.Days))
		sb.WriteString(fmt.Sprintf("    --trading-mode %s \\\n", exch.TradingMode))
		sb.WriteString("    --data-format-ohlcv json\n\n")
	}

	// Phase 3: Package data with tar.gz
	sb.WriteString("# Phase 3: Package data\n")
	sb.WriteString("echo \"Packaging data...\"\n")
	sb.WriteString("cd /freqtrade/user_data/data\n")
	sb.WriteString("tar -czf /tmp/data.tar.gz .\n\n")

	// Phase 4: Upload to S3 using Python
	sb.WriteString("# Phase 4: Upload to S3\n")
	sb.WriteString("echo \"Uploading to S3...\"\n")
	sb.WriteString("echo \"UPLOAD_URL: $UPLOAD_URL\"\n")
	sb.WriteString("python3 -c \"\n")
	sb.WriteString("import urllib.request\n")
	sb.WriteString("import os\n")
	sb.WriteString("url = os.environ['UPLOAD_URL']\n")
	sb.WriteString("print(f'Uploading to: {url[:100]}...')\n")
	sb.WriteString("with open('/tmp/data.tar.gz', 'rb') as f:\n")
	sb.WriteString("    data = f.read()\n")
	sb.WriteString("print(f'Data size: {len(data)} bytes')\n")
	sb.WriteString("req = urllib.request.Request(url, data=data, method='PUT')\n")
	sb.WriteString("req.add_header('Content-Type', 'application/gzip')\n")
	sb.WriteString("urllib.request.urlopen(req)\n")
	sb.WriteString("print('Upload completed')\n")
	sb.WriteString("\"\n\n")

	// Phase 5: Extract data metadata by scanning downloaded files
	// Uses file system scanning as freqtrade list-data uses rich formatting that's hard to parse
	sb.WriteString("# Phase 5: Extract available data metadata\n")
	sb.WriteString("echo \"Extracting data metadata...\"\n")
	sb.WriteString("python3 << 'METADATA_SCRIPT'\n")
	sb.WriteString(`import os
import json
import re
from datetime import datetime, timezone

data_dir = '/freqtrade/user_data/data'
result = {'exchanges': []}

# Scan data directory for exchanges
if os.path.isdir(data_dir):
    for exchange_name in sorted(os.listdir(data_dir)):
        exchange_path = os.path.join(data_dir, exchange_name)
        if not os.path.isdir(exchange_path):
            continue

        exchange_data = {'name': exchange_name, 'pairs': []}
        pairs_map = {}  # pair -> list of timeframe data

        # Scan exchange directory for data files
        # Freqtrade file formats:
        # - Spot: BTC_USDT-1h.json
        # - Futures: BTC_USDT_USDT-1h-futures.json (pair is BTC/USDT:USDT)
        for filename in os.listdir(exchange_path):
            if not filename.endswith('.json'):
                continue

            # Try to parse filename
            # Pattern 1: BASE_QUOTE-TIMEFRAME.json (spot)
            # Pattern 2: BASE_QUOTE_SETTLE-TIMEFRAME-futures.json (futures)
            basename = filename[:-5]  # remove .json

            # Check for futures format
            is_futures = '-futures' in basename or '-mark' in basename
            if is_futures:
                basename = re.sub(r'-(futures|mark)$', '', basename)

            # Split by last dash to get timeframe
            parts = basename.rsplit('-', 1)
            if len(parts) != 2:
                continue

            pair_part, timeframe = parts

            # Parse pair: BTC_USDT or BTC_USDT_USDT (futures with settlement)
            pair_parts = pair_part.split('_')
            if len(pair_parts) == 2:
                # Spot: BTC_USDT -> BTC/USDT
                pair = f'{pair_parts[0]}/{pair_parts[1]}'
            elif len(pair_parts) == 3:
                # Futures: BTC_USDT_USDT -> BTC/USDT:USDT
                pair = f'{pair_parts[0]}/{pair_parts[1]}:{pair_parts[2]}'
            else:
                continue

            # Get date range from file content (first and last candle)
            file_path = os.path.join(exchange_path, filename)
            from_date = None
            to_date = None
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        # Freqtrade JSON format: [[timestamp, o, h, l, c, v], ...]
                        first_candle = data[0]
                        last_candle = data[-1]
                        from_ts = first_candle[0] / 1000  # ms to s
                        to_ts = last_candle[0] / 1000
                        from_date = datetime.fromtimestamp(from_ts, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
                        to_date = datetime.fromtimestamp(to_ts, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            except Exception as e:
                print(f'Warning: Could not read {filename}: {e}', flush=True)

            if pair not in pairs_map:
                pairs_map[pair] = []

            # Avoid duplicates
            existing = [t for t in pairs_map[pair] if t['timeframe'] == timeframe]
            if not existing:
                pairs_map[pair].append({
                    'timeframe': timeframe,
                    'from': from_date,
                    'to': to_date
                })

        # Convert pairs map to list
        for pair, timeframes in sorted(pairs_map.items()):
            exchange_data['pairs'].append({
                'pair': pair,
                'timeframes': sorted(timeframes, key=lambda x: x['timeframe'])
            })

        if exchange_data['pairs']:
            result['exchanges'].append(exchange_data)

# Output with delimiters for parsing
print('===DATA_AVAILABLE_START===')
print(json.dumps(result))
print('===DATA_AVAILABLE_END===')
`)
	sb.WriteString("METADATA_SCRIPT\n\n")

	sb.WriteString("echo \"Data download and upload completed successfully!\"\n")

	return sb.String()
}

// CreateDataDownloaderFromConfig is a factory function for creating DataDownloader.
func CreateDataDownloaderFromConfig(ctx context.Context, config map[string]interface{}) (runner.DataDownloader, error) {
	cfg, err := ParseConfig(config)
	if err != nil {
		return nil, err
	}
	return NewDataDownloader(ctx, cfg)
}
