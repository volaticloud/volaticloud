package kubernetes

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"strings"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

// Compile-time interface compliance check
var _ runner.DataDownloader = (*DataDownloader)(nil)

// Labels for data download resources
const (
	LabelDataDownloadID   = "volaticloud.io/data-download-id"
	ComponentDataDownload = "data-download"
)

// DataDownloader implements runner.DataDownloader for Kubernetes.
// It runs data download Jobs on the Kubernetes cluster.
type DataDownloader struct {
	config    *Config
	clientset kubernetes.Interface
}

// NewDataDownloader creates a new Kubernetes data downloader.
func NewDataDownloader(ctx context.Context, config *Config) (*DataDownloader, error) {
	restConfig, err := buildRestConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to build REST config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	// Verify connection by checking namespace
	_, err = clientset.CoreV1().Namespaces().Get(ctx, config.Namespace, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, fmt.Errorf("namespace %q not found", config.Namespace)
		}
		return nil, fmt.Errorf("failed to connect to Kubernetes API: %w", err)
	}

	return &DataDownloader{
		config:    config,
		clientset: clientset,
	}, nil
}

// StartDownload starts a data download Job on the Kubernetes cluster.
func (d *DataDownloader) StartDownload(ctx context.Context, spec runner.DataDownloadSpec) (string, error) {
	// Build the download script
	script := buildK8sDownloadScript(spec)

	// Generate job name
	jobName := fmt.Sprintf("volaticloud-data-download-%s", spec.RunnerID)

	// Build environment variables
	env := []corev1.EnvVar{
		{
			Name:  "UPLOAD_URL",
			Value: spec.UploadURL,
		},
	}
	if spec.ExistingDataURL != "" {
		env = append(env, corev1.EnvVar{
			Name:  "EXISTING_DATA_URL",
			Value: spec.ExistingDataURL,
		})
	}

	backoffLimit := int32(0)
	ttlSeconds := int32(3600) // 1 hour cleanup after completion

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: d.config.Namespace,
			Labels: map[string]string{
				LabelManaged:        "true",
				LabelDataDownloadID: spec.RunnerID,
				LabelTaskType:       ComponentDataDownload,
			},
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            &backoffLimit,
			TTLSecondsAfterFinished: &ttlSeconds,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						LabelManaged:        "true",
						LabelDataDownloadID: spec.RunnerID,
						LabelTaskType:       ComponentDataDownload,
					},
				},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:    "data-downloader",
							Image:   spec.FreqtradeImage,
							Command: []string{"/bin/sh", "-c"},
							Args:    []string{script},
							Env:     env,
						},
					},
				},
			},
		},
	}

	created, err := d.clientset.BatchV1().Jobs(d.config.Namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to create job: %w", err)
	}

	log.Printf("Started data download job: %s (runner: %s)", created.Name, spec.RunnerID)
	return created.Name, nil
}

// GetDownloadStatus returns the current status of a download Job.
func (d *DataDownloader) GetDownloadStatus(ctx context.Context, taskID string) (*runner.DataDownloadStatus, error) {
	job, err := d.clientset.BatchV1().Jobs(d.config.Namespace).Get(ctx, taskID, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, fmt.Errorf("job %s not found", taskID)
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	status := &runner.DataDownloadStatus{
		TaskID: taskID,
	}

	// Determine status from Job conditions
	if job.Status.Succeeded > 0 {
		status.Status = enum.DataDownloadStatusCompleted
		status.Progress = 100
		status.CurrentPhase = "completed"
		if job.Status.CompletionTime != nil {
			completedAt := job.Status.CompletionTime.Time
			status.CompletedAt = &completedAt
		}
	} else if job.Status.Failed > 0 {
		status.Status = enum.DataDownloadStatusFailed
		status.CurrentPhase = "failed"
		for _, cond := range job.Status.Conditions {
			if cond.Type == batchv1.JobFailed {
				status.ErrorMessage = cond.Message
			}
		}
	} else if job.Status.Active > 0 {
		status.Status = enum.DataDownloadStatusDownloading
		status.CurrentPhase = "downloading"
		if job.Status.StartTime != nil {
			startedAt := job.Status.StartTime.Time
			status.StartedAt = &startedAt
		}
	} else {
		status.Status = enum.DataDownloadStatusPending
		status.CurrentPhase = "pending"
	}

	return status, nil
}

// GetDownloadLogs returns logs from the download Job's pod.
func (d *DataDownloader) GetDownloadLogs(ctx context.Context, taskID string) (string, error) {
	// Get the job to find its runner ID
	job, err := d.clientset.BatchV1().Jobs(d.config.Namespace).Get(ctx, taskID, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get job: %w", err)
	}

	runnerID := job.Labels[LabelDataDownloadID]
	if runnerID == "" {
		runnerID = taskID
	}

	// Find pods for this job
	pods, err := d.clientset.CoreV1().Pods(d.config.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelDataDownloadID, runnerID),
	})
	if err != nil {
		return "", fmt.Errorf("failed to list pods: %w", err)
	}
	if len(pods.Items) == 0 {
		return "", fmt.Errorf("no pods found for job %s", taskID)
	}

	pod := pods.Items[0]

	// Get logs from the container
	podLogOpts := &corev1.PodLogOptions{
		Container: "data-downloader",
	}

	req := d.clientset.CoreV1().Pods(d.config.Namespace).GetLogs(pod.Name, podLogOpts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get logs stream: %w", err)
	}
	defer stream.Close()

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, stream); err != nil {
		return "", fmt.Errorf("failed to read logs: %w", err)
	}

	return buf.String(), nil
}

// CancelDownload cancels a running download Job.
func (d *DataDownloader) CancelDownload(ctx context.Context, taskID string) error {
	propagationPolicy := metav1.DeletePropagationForeground
	err := d.clientset.BatchV1().Jobs(d.config.Namespace).Delete(ctx, taskID, metav1.DeleteOptions{
		PropagationPolicy: &propagationPolicy,
	})
	if err != nil && !errors.IsNotFound(err) {
		return fmt.Errorf("failed to delete job: %w", err)
	}
	return nil
}

// CleanupDownload removes the download Job and its pods.
func (d *DataDownloader) CleanupDownload(ctx context.Context, taskID string) error {
	propagationPolicy := metav1.DeletePropagationBackground
	err := d.clientset.BatchV1().Jobs(d.config.Namespace).Delete(ctx, taskID, metav1.DeleteOptions{
		PropagationPolicy: &propagationPolicy,
	})
	if err != nil && !errors.IsNotFound(err) {
		return fmt.Errorf("failed to delete job: %w", err)
	}
	return nil
}

// buildK8sDownloadScript creates the shell script for data download in K8s.
// Uses Python (available in freqtrade image) for S3 operations.
func buildK8sDownloadScript(spec runner.DataDownloadSpec) string {
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
	sb.WriteString("python3 -c \"\n")
	sb.WriteString("import urllib.request\n")
	sb.WriteString("import os\n")
	sb.WriteString("url = os.environ['UPLOAD_URL']\n")
	sb.WriteString("with open('/tmp/data.tar.gz', 'rb') as f:\n")
	sb.WriteString("    data = f.read()\n")
	sb.WriteString("req = urllib.request.Request(url, data=data, method='PUT')\n")
	sb.WriteString("req.add_header('Content-Type', 'application/gzip')\n")
	sb.WriteString("urllib.request.urlopen(req)\n")
	sb.WriteString("print('Upload completed')\n")
	sb.WriteString("\"\n\n")

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
