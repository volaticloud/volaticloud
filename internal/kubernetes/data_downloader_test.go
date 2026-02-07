package kubernetes

import (
	"context"
	"strings"
	"testing"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

func TestBuildK8sDownloadScript(t *testing.T) {
	tests := []struct {
		name        string
		spec        runner.DataDownloadSpec
		wantContain []string
		wantExclude []string
	}{
		{
			name: "basic single exchange",
			spec: runner.DataDownloadSpec{
				RunnerID:       "test-runner",
				UploadURL:      "https://s3.example.com/upload",
				FreqtradeImage: "freqtradeorg/freqtrade:stable",
				ExchangeConfigs: []runner.ExchangeDownloadConfig{
					{
						Name:         "binance",
						PairsPattern: "BTC/USDT",
						Timeframes:   []string{"1h", "4h"},
						Days:         7,
						TradingMode:  "spot",
					},
				},
			},
			wantContain: []string{
				"set -e",
				"freqtrade download-data",
				"--exchange 'binance'",
				"--pairs 'BTC/USDT'",
			},
			wantExclude: []string{
				"UPLOAD_URL:", // Verbose output should be excluded
			},
		},
		{
			name: "shell injection is escaped",
			spec: runner.DataDownloadSpec{
				RunnerID:       "test-runner",
				UploadURL:      "https://s3.example.com/upload",
				FreqtradeImage: "freqtradeorg/freqtrade:stable",
				ExchangeConfigs: []runner.ExchangeDownloadConfig{
					{
						Name:         "'; rm -rf / #",
						PairsPattern: "$(whoami)/USDT",
						Timeframes:   []string{"1h"},
						Days:         7,
						TradingMode:  "spot",
					},
				},
			},
			wantContain: []string{
				// Malicious input should be escaped
				"--pairs '$(whoami)/USDT'",
			},
			wantExclude: []string{
				// Unescaped version should NOT appear
				"--exchange '; rm -rf",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			script := buildK8sDownloadScript(tt.spec)

			for _, want := range tt.wantContain {
				if !strings.Contains(script, want) {
					t.Errorf("buildK8sDownloadScript() missing expected content: %q", want)
				}
			}

			for _, notWant := range tt.wantExclude {
				if strings.Contains(script, notWant) {
					t.Errorf("buildK8sDownloadScript() contains unexpected content: %q", notWant)
				}
			}
		})
	}
}

func TestBuildK8sDownloadScript_VerboseDisabled(t *testing.T) {
	spec := runner.DataDownloadSpec{
		RunnerID:       "test-runner",
		UploadURL:      "https://s3.example.com/upload",
		FreqtradeImage: "freqtradeorg/freqtrade:stable",
		ExchangeConfigs: []runner.ExchangeDownloadConfig{
			{
				Name:         "binance",
				PairsPattern: "BTC/USDT",
				Timeframes:   []string{"1h"},
				Days:         7,
				TradingMode:  "spot",
			},
		},
	}

	script := buildK8sDownloadScript(spec)

	// K8s script should NOT have verbose debug output (verbose=false)
	verboseIndicators := []string{
		"echo \"UPLOAD_URL:",
		"Uploading to:",
		"Data size:",
	}

	for _, indicator := range verboseIndicators {
		if strings.Contains(script, indicator) {
			t.Errorf("K8s script should not contain verbose output: %q", indicator)
		}
	}
}

func TestDataDownloader_GetDownloadStatus(t *testing.T) {
	tests := []struct {
		name           string
		job            *batchv1.Job
		expectedStatus enum.DataDownloadStatus
		expectedPhase  string
	}{
		{
			name: "pending job",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-job",
					Namespace: "default",
				},
				Status: batchv1.JobStatus{
					Active:    0,
					Succeeded: 0,
					Failed:    0,
				},
			},
			expectedStatus: enum.DataDownloadStatusPending,
			expectedPhase:  "pending",
		},
		{
			name: "active job",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-job",
					Namespace: "default",
				},
				Status: batchv1.JobStatus{
					Active:    1,
					Succeeded: 0,
					Failed:    0,
					StartTime: &metav1.Time{Time: time.Now()},
				},
			},
			expectedStatus: enum.DataDownloadStatusDownloading,
			expectedPhase:  "downloading",
		},
		{
			name: "succeeded job",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-job",
					Namespace: "default",
				},
				Status: batchv1.JobStatus{
					Active:         0,
					Succeeded:      1,
					Failed:         0,
					CompletionTime: &metav1.Time{Time: time.Now()},
				},
			},
			expectedStatus: enum.DataDownloadStatusCompleted,
			expectedPhase:  "completed",
		},
		{
			name: "failed job",
			job: &batchv1.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-job",
					Namespace: "default",
				},
				Status: batchv1.JobStatus{
					Active:    0,
					Succeeded: 0,
					Failed:    1,
					Conditions: []batchv1.JobCondition{
						{
							Type:    batchv1.JobFailed,
							Status:  corev1.ConditionTrue,
							Message: "BackoffLimitExceeded",
						},
					},
				},
			},
			expectedStatus: enum.DataDownloadStatusFailed,
			expectedPhase:  "failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fake clientset with the test job
			clientset := fake.NewSimpleClientset(tt.job)

			d := &DataDownloader{
				config: &Config{
					Namespace: "default",
				},
				clientset: clientset,
			}

			status, err := d.GetDownloadStatus(context.Background(), tt.job.Name)
			if err != nil {
				t.Fatalf("GetDownloadStatus() error = %v", err)
			}

			if status.Status != tt.expectedStatus {
				t.Errorf("GetDownloadStatus() status = %v, want %v", status.Status, tt.expectedStatus)
			}

			if status.CurrentPhase != tt.expectedPhase {
				t.Errorf("GetDownloadStatus() phase = %v, want %v", status.CurrentPhase, tt.expectedPhase)
			}
		})
	}
}

func TestDataDownloader_GetDownloadStatus_NotFound(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	d := &DataDownloader{
		config: &Config{
			Namespace: "default",
		},
		clientset: clientset,
	}

	_, err := d.GetDownloadStatus(context.Background(), "nonexistent-job")
	if err == nil {
		t.Error("GetDownloadStatus() expected error for non-existent job")
	}

	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("GetDownloadStatus() error = %v, want 'not found'", err)
	}
}

func TestDataDownloader_CancelDownload(t *testing.T) {
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "default",
		},
	}

	clientset := fake.NewSimpleClientset(job)

	d := &DataDownloader{
		config: &Config{
			Namespace: "default",
		},
		clientset: clientset,
	}

	// Cancel should succeed
	err := d.CancelDownload(context.Background(), "test-job")
	if err != nil {
		t.Fatalf("CancelDownload() error = %v", err)
	}

	// Verify job is deleted
	_, err = clientset.BatchV1().Jobs("default").Get(context.Background(), "test-job", metav1.GetOptions{})
	if err == nil {
		t.Error("CancelDownload() job still exists after cancellation")
	}
}

func TestDataDownloader_CancelDownload_NotFound(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	d := &DataDownloader{
		config: &Config{
			Namespace: "default",
		},
		clientset: clientset,
	}

	// Cancel non-existent job should not error (idempotent)
	err := d.CancelDownload(context.Background(), "nonexistent-job")
	if err != nil {
		t.Errorf("CancelDownload() unexpected error for non-existent job: %v", err)
	}
}

func TestDataDownloader_CleanupDownload(t *testing.T) {
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "default",
		},
	}

	clientset := fake.NewSimpleClientset(job)

	d := &DataDownloader{
		config: &Config{
			Namespace: "default",
		},
		clientset: clientset,
	}

	// Cleanup should succeed
	err := d.CleanupDownload(context.Background(), "test-job")
	if err != nil {
		t.Fatalf("CleanupDownload() error = %v", err)
	}
}
