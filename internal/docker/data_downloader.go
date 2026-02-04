package docker

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
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
// Delegates to the shared runner.BuildDownloadScript with verbose=true for Docker debugging.
func buildDownloadScript(spec runner.DataDownloadSpec) string {
	return runner.BuildDownloadScript(spec, true) // verbose=true for Docker debugging
}

// CreateDataDownloaderFromConfig is a factory function for creating DataDownloader.
func CreateDataDownloaderFromConfig(ctx context.Context, config map[string]interface{}) (runner.DataDownloader, error) {
	cfg, err := ParseConfig(config)
	if err != nil {
		return nil, err
	}
	return NewDataDownloader(ctx, cfg)
}
