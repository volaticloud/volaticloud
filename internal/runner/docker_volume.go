package runner

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

const (
	// Default volume names
	BotConfigVolume    = "volaticloud-bot-configs"
	BacktestUserDirVol = "volaticloud-freqtrade-userdir"
	BacktestDataVol    = "volaticloud-freqtrade-data"

	// Helper image for volume operations
	alpineImage = "alpine:latest"
)

// DockerVolumeHelper provides utilities for managing files in Docker volumes.
// This is useful when working with remote Docker daemons where local filesystem
// paths are not accessible.
type DockerVolumeHelper struct {
	client *client.Client
}

// NewDockerVolumeHelper creates a new volume helper using the provided Docker client
func NewDockerVolumeHelper(cli *client.Client) *DockerVolumeHelper {
	return &DockerVolumeHelper{client: cli}
}

// EnsureAlpineImage ensures the alpine image is available for volume operations
func (h *DockerVolumeHelper) EnsureAlpineImage(ctx context.Context) error {
	// Check if image exists locally
	_, err := h.client.ImageInspect(ctx, alpineImage)
	if err == nil {
		return nil // Image exists
	}

	// Pull image
	reader, err := h.client.ImagePull(ctx, alpineImage, image.PullOptions{})
	if err != nil {
		return fmt.Errorf("failed to pull alpine image: %w", err)
	}
	defer reader.Close()

	// Wait for pull to complete
	_, err = io.Copy(io.Discard, reader)
	return err
}

// WriteFile writes a file to a Docker volume using a temporary container.
// The filePath is relative to the volume root.
func (h *DockerVolumeHelper) WriteFile(ctx context.Context, volumeName string, filePath string, content []byte) error {
	// Ensure alpine image exists
	if err := h.EnsureAlpineImage(ctx); err != nil {
		return err
	}

	// Escape content for shell - handle single quotes properly
	escaped := strings.ReplaceAll(string(content), "'", "'\\''")

	// Create a temporary alpine container to write to the volume
	// Uses printf to avoid interpretation of escape sequences
	containerConfig := &container.Config{
		Image: alpineImage,
		Cmd: []string{"sh", "-c", fmt.Sprintf(
			"mkdir -p \"$(dirname '/data/%s')\" && printf '%%s' '%s' > '/data/%s'",
			filePath, escaped, filePath)},
	}

	hostConfig := &container.HostConfig{
		AutoRemove: false,
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeVolume,
				Source: volumeName,
				Target: "/data",
			},
		},
	}

	return h.runTempContainer(ctx, containerConfig, hostConfig)
}

// ReadFile reads a file from a Docker volume using a temporary container.
// The filePath is relative to the volume root.
func (h *DockerVolumeHelper) ReadFile(ctx context.Context, volumeName string, filePath string) ([]byte, error) {
	// Ensure alpine image exists
	if err := h.EnsureAlpineImage(ctx); err != nil {
		return nil, err
	}

	containerConfig := &container.Config{
		Image: alpineImage,
		Cmd:   []string{"cat", filepath.Join("/data", filePath)},
	}

	hostConfig := &container.HostConfig{
		AutoRemove: false,
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeVolume,
				Source:   volumeName,
				Target:   "/data",
				ReadOnly: true,
			},
		},
	}

	return h.runTempContainerWithOutput(ctx, containerConfig, hostConfig)
}

// ReadFileFromZip reads a specific file from a zip archive in a Docker volume.
// Requires unzip to be available in the alpine image.
func (h *DockerVolumeHelper) ReadFileFromZip(ctx context.Context, volumeName string, zipPath string, fileInZip string) ([]byte, error) {
	// Ensure alpine image exists
	if err := h.EnsureAlpineImage(ctx); err != nil {
		return nil, err
	}

	containerConfig := &container.Config{
		Image: alpineImage,
		Cmd:   []string{"sh", "-c", fmt.Sprintf("unzip -p /data/%s %s", zipPath, fileInZip)},
	}

	hostConfig := &container.HostConfig{
		AutoRemove: false,
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeVolume,
				Source:   volumeName,
				Target:   "/data",
				ReadOnly: true,
			},
		},
	}

	return h.runTempContainerWithOutput(ctx, containerConfig, hostConfig)
}

// RemoveDirectory removes a directory from a Docker volume.
// The dirPath is relative to the volume root.
func (h *DockerVolumeHelper) RemoveDirectory(ctx context.Context, volumeName string, dirPath string) error {
	// Ensure alpine image exists
	if err := h.EnsureAlpineImage(ctx); err != nil {
		return err
	}

	containerConfig := &container.Config{
		Image: alpineImage,
		Cmd:   []string{"sh", "-c", fmt.Sprintf("rm -rf /data/%s", dirPath)},
	}

	hostConfig := &container.HostConfig{
		AutoRemove: false,
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeVolume,
				Source: volumeName,
				Target: "/data",
			},
		},
	}

	return h.runTempContainer(ctx, containerConfig, hostConfig)
}

// runTempContainer runs a temporary container and waits for completion
func (h *DockerVolumeHelper) runTempContainer(ctx context.Context, containerConfig *container.Config, hostConfig *container.HostConfig) error {
	// Create container
	resp, err := h.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, "")
	if err != nil {
		return fmt.Errorf("failed to create temp container: %w", err)
	}

	// Ensure cleanup
	defer h.client.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})

	// Start container
	if err := h.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return fmt.Errorf("failed to start temp container: %w", err)
	}

	// Wait for container to finish
	statusCh, errCh := h.client.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("error waiting for container: %w", err)
		}
	case status := <-statusCh:
		if status.StatusCode != 0 {
			logs := h.getContainerOutput(ctx, resp.ID)
			return fmt.Errorf("container exited with code %d: %s", status.StatusCode, logs)
		}
	}

	return nil
}

// runTempContainerWithOutput runs a temporary container and returns its stdout
func (h *DockerVolumeHelper) runTempContainerWithOutput(ctx context.Context, containerConfig *container.Config, hostConfig *container.HostConfig) ([]byte, error) {
	// Create container
	resp, err := h.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp container: %w", err)
	}

	// Ensure cleanup
	defer h.client.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})

	// Start container
	if err := h.client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("failed to start temp container: %w", err)
	}

	// Wait for container to finish
	statusCh, errCh := h.client.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return nil, fmt.Errorf("error waiting for container: %w", err)
		}
	case status := <-statusCh:
		if status.StatusCode != 0 {
			logs := h.getContainerOutput(ctx, resp.ID)
			return nil, fmt.Errorf("container exited with code %d: %s", status.StatusCode, logs)
		}
	}

	// Get file content
	output := h.getContainerOutput(ctx, resp.ID)
	if output == "" {
		return nil, fmt.Errorf("no output returned")
	}

	return []byte(output), nil
}

// getContainerOutput reads container stdout/stderr and strips Docker log framing
func (h *DockerVolumeHelper) getContainerOutput(ctx context.Context, containerID string) string {
	reader, err := h.client.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	if err != nil {
		return ""
	}
	defer reader.Close()

	// Use stdcopy to demultiplex Docker log streams and remove framing bytes
	var stdout, stderr bytes.Buffer
	_, err = stdcopy.StdCopy(&stdout, &stderr, reader)
	if err != nil {
		return ""
	}

	return stdout.String()
}
