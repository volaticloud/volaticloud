package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateConfig(t *testing.T) {
	tests := []struct {
		name    string
		config  *Config
		wantErr string
	}{
		{
			name: "ValidMinimalConfig",
			config: &Config{
				Namespace: "volaticloud",
			},
			wantErr: "",
		},
		{
			name: "ValidFullConfig",
			config: &Config{
				Kubeconfig:       "/home/user/.kube/config",
				Context:          "production",
				Namespace:        "volaticloud-prod",
				StorageClassName: "nfs-client",
				SharedDataPVC:    "custom-data-pvc",
				FreqtradeImage:   "freqtradeorg/freqtrade:2024.1",
				PrometheusURL:    "http://prometheus:9090",
				DefaultResources: &ResourceDefaults{
					CPURequest:    "250m",
					CPULimit:      "1000m",
					MemoryRequest: "256Mi",
					MemoryLimit:   "512Mi",
				},
			},
			wantErr: "",
		},
		{
			name:    "ErrorNilConfig",
			config:  nil,
			wantErr: "kubernetes config is required",
		},
		{
			name: "ErrorMissingNamespace",
			config: &Config{
				Kubeconfig: "/home/user/.kube/config",
			},
			wantErr: "namespace is required",
		},
		{
			name: "ErrorInvalidNamespace_TooLong",
			config: &Config{
				Namespace: "this-namespace-name-is-way-too-long-and-exceeds-the-sixty-three-character-limit",
			},
			wantErr: "namespace must be a valid DNS label",
		},
		{
			name: "ErrorInvalidNamespace_UpperCase",
			config: &Config{
				Namespace: "MyNamespace",
			},
			wantErr: "namespace must be a valid DNS label",
		},
		{
			name: "ErrorInvalidNamespace_StartWithHyphen",
			config: &Config{
				Namespace: "-invalid",
			},
			wantErr: "namespace must be a valid DNS label",
		},
		{
			name: "ErrorInvalidNamespace_EndWithHyphen",
			config: &Config{
				Namespace: "invalid-",
			},
			wantErr: "namespace must be a valid DNS label",
		},
		{
			name: "ErrorInvalidNamespace_SpecialChars",
			config: &Config{
				Namespace: "invalid_namespace",
			},
			wantErr: "namespace must be a valid DNS label",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateConfig(tt.config)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestParseConfig(t *testing.T) {
	tests := []struct {
		name    string
		data    map[string]interface{}
		want    *Config
		wantErr string
	}{
		{
			name: "ValidConfig",
			data: map[string]interface{}{
				"namespace": "volaticloud",
			},
			want: &Config{
				Namespace:      "volaticloud",
				SharedDataPVC:  DefaultSharedDataPVC,
				FreqtradeImage: DefaultFreqtradeImage,
			},
			wantErr: "",
		},
		{
			name: "ValidConfigWithAllFields",
			data: map[string]interface{}{
				"kubeconfig":       "/home/user/.kube/config",
				"context":          "production",
				"namespace":        "volaticloud-prod",
				"storageClassName": "nfs-client",
				"sharedDataPVC":    "custom-data-pvc",
				"freqtradeImage":   "freqtradeorg/freqtrade:2024.1",
				"prometheusUrl":    "http://prometheus:9090",
				"defaultResources": map[string]interface{}{
					"cpuRequest":    "250m",
					"cpuLimit":      "1000m",
					"memoryRequest": "256Mi",
					"memoryLimit":   "512Mi",
				},
			},
			want: &Config{
				Kubeconfig:       "/home/user/.kube/config",
				Context:          "production",
				Namespace:        "volaticloud-prod",
				StorageClassName: "nfs-client",
				SharedDataPVC:    "custom-data-pvc",
				FreqtradeImage:   "freqtradeorg/freqtrade:2024.1",
				PrometheusURL:    "http://prometheus:9090",
				DefaultResources: &ResourceDefaults{
					CPURequest:    "250m",
					CPULimit:      "1000m",
					MemoryRequest: "256Mi",
					MemoryLimit:   "512Mi",
				},
			},
			wantErr: "",
		},
		{
			name:    "ErrorNilData",
			data:    nil,
			want:    nil,
			wantErr: "kubernetes config is required",
		},
		{
			name: "ErrorMissingNamespace",
			data: map[string]interface{}{
				"kubeconfig": "/home/user/.kube/config",
			},
			want:    nil,
			wantErr: "namespace is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseConfig(tt.data)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
				assert.Nil(t, got)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want.Namespace, got.Namespace)
				assert.Equal(t, tt.want.SharedDataPVC, got.SharedDataPVC)
				assert.Equal(t, tt.want.FreqtradeImage, got.FreqtradeImage)
				if tt.want.Kubeconfig != "" {
					assert.Equal(t, tt.want.Kubeconfig, got.Kubeconfig)
				}
				if tt.want.PrometheusURL != "" {
					assert.Equal(t, tt.want.PrometheusURL, got.PrometheusURL)
				}
			}
		})
	}
}

func TestConfigToMap(t *testing.T) {
	tests := []struct {
		name   string
		config *Config
		want   map[string]interface{}
	}{
		{
			name: "BasicConfig",
			config: &Config{
				Namespace:      "volaticloud",
				SharedDataPVC:  DefaultSharedDataPVC,
				FreqtradeImage: DefaultFreqtradeImage,
			},
			want: map[string]interface{}{
				"namespace":      "volaticloud",
				"sharedDataPVC":  DefaultSharedDataPVC,
				"freqtradeImage": DefaultFreqtradeImage,
			},
		},
		{
			name: "FullConfig",
			config: &Config{
				Kubeconfig:       "/home/user/.kube/config",
				Context:          "production",
				Namespace:        "volaticloud-prod",
				StorageClassName: "nfs-client",
				SharedDataPVC:    "custom-data-pvc",
				FreqtradeImage:   "freqtradeorg/freqtrade:2024.1",
				PrometheusURL:    "http://prometheus:9090",
			},
			want: map[string]interface{}{
				"kubeconfig":       "/home/user/.kube/config",
				"context":          "production",
				"namespace":        "volaticloud-prod",
				"storageClassName": "nfs-client",
				"sharedDataPVC":    "custom-data-pvc",
				"freqtradeImage":   "freqtradeorg/freqtrade:2024.1",
				"prometheusUrl":    "http://prometheus:9090",
			},
		},
		{
			name: "RoundTrip",
			config: &Config{
				Namespace:      "test-ns",
				SharedDataPVC:  "test-pvc",
				FreqtradeImage: "freqtradeorg/freqtrade:test",
			},
			want: map[string]interface{}{
				"namespace":      "test-ns",
				"sharedDataPVC":  "test-pvc",
				"freqtradeImage": "freqtradeorg/freqtrade:test",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.config.ToMap()
			assert.Equal(t, tt.want["namespace"], got["namespace"])
			if tt.want["kubeconfig"] != nil {
				assert.Equal(t, tt.want["kubeconfig"], got["kubeconfig"])
			}
		})
	}
}

func TestGetFreqtradeImage(t *testing.T) {
	config := &Config{
		FreqtradeImage: "freqtradeorg/freqtrade:stable",
	}

	// Test with no version override
	assert.Equal(t, "freqtradeorg/freqtrade:stable", config.GetFreqtradeImage(""))

	// Test with version override
	assert.Equal(t, "freqtradeorg/freqtrade:2024.1", config.GetFreqtradeImage("2024.1"))
}

func TestIsValidNamespaceName(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"valid simple", "default", true},
		{"valid with numbers", "namespace123", true},
		{"valid with hyphens", "my-namespace", true},
		{"valid complex", "my-ns-123", true},
		{"invalid uppercase", "MyNamespace", false},
		{"invalid underscore", "my_namespace", false},
		{"invalid start hyphen", "-namespace", false},
		{"invalid end hyphen", "namespace-", false},
		{"invalid empty", "", false},
		{"invalid too long", "this-namespace-name-is-way-too-long-and-exceeds-the-sixty-three-character-limit", false},
		{"invalid dot", "my.namespace", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isValidNamespaceName(tt.input))
		})
	}
}
