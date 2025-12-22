package kubernetes

import (
	"encoding/json"
	"fmt"
)

// Config holds the configuration for connecting to a Kubernetes cluster
// and managing bot/backtest resources.
type Config struct {
	// Kubeconfig is the path to the kubeconfig file.
	// If empty, in-cluster configuration will be used (when running inside K8s).
	Kubeconfig string `json:"kubeconfig,omitempty"`

	// Context is the kubeconfig context to use.
	// If empty, the current context will be used.
	Context string `json:"context,omitempty"`

	// Namespace is the Kubernetes namespace for all resources.
	// This field is required.
	Namespace string `json:"namespace"`

	// StorageClassName is the storage class for PersistentVolumeClaims.
	// Must support ReadWriteMany access mode for shared data.
	// If empty, the default storage class will be used.
	StorageClassName string `json:"storageClassName,omitempty"`

	// SharedDataPVC is the name of the PVC for shared historical data.
	// Default: "volaticloud-freqtrade-data"
	SharedDataPVC string `json:"sharedDataPVC,omitempty"`

	// FreqtradeImage is the default Freqtrade Docker image.
	// Default: "freqtradeorg/freqtrade:stable"
	FreqtradeImage string `json:"freqtradeImage,omitempty"`

	// PrometheusURL is the URL of the Prometheus server for metrics.
	// Used to collect network and disk I/O metrics via cAdvisor.
	// If empty, only CPU/memory metrics will be available.
	PrometheusURL string `json:"prometheusUrl,omitempty"`

	// DefaultResources specifies default resource requests/limits for pods.
	DefaultResources *ResourceDefaults `json:"defaultResources,omitempty"`
}

// ResourceDefaults specifies default CPU and memory resources.
type ResourceDefaults struct {
	CPURequest    string `json:"cpuRequest,omitempty"`    // e.g., "250m"
	CPULimit      string `json:"cpuLimit,omitempty"`      // e.g., "1000m"
	MemoryRequest string `json:"memoryRequest,omitempty"` // e.g., "256Mi"
	MemoryLimit   string `json:"memoryLimit,omitempty"`   // e.g., "512Mi"
}

// DefaultSharedDataPVC is the default name for the shared data PVC.
const DefaultSharedDataPVC = "volaticloud-freqtrade-data"

// DefaultFreqtradeImage is the default Freqtrade Docker image.
const DefaultFreqtradeImage = "freqtradeorg/freqtrade:stable"

// ParseConfig parses and validates a Kubernetes configuration from a map.
func ParseConfig(data map[string]interface{}) (*Config, error) {
	if data == nil {
		return nil, fmt.Errorf("kubernetes config is required")
	}

	// Marshal to JSON and unmarshal to Config struct
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	var config Config
	if err := json.Unmarshal(jsonData, &config); err != nil {
		return nil, fmt.Errorf("failed to parse kubernetes config: %w", err)
	}

	// Apply defaults
	if config.SharedDataPVC == "" {
		config.SharedDataPVC = DefaultSharedDataPVC
	}
	if config.FreqtradeImage == "" {
		config.FreqtradeImage = DefaultFreqtradeImage
	}

	// Validate
	if err := ValidateConfig(&config); err != nil {
		return nil, err
	}

	return &config, nil
}

// ValidateConfig validates the Kubernetes configuration.
func ValidateConfig(config *Config) error {
	if config == nil {
		return fmt.Errorf("kubernetes config is required")
	}

	if config.Namespace == "" {
		return fmt.Errorf("namespace is required")
	}

	// Validate namespace format (RFC 1123 DNS label)
	if !isValidNamespaceName(config.Namespace) {
		return fmt.Errorf("namespace must be a valid DNS label (lowercase, alphanumeric, hyphens allowed, max 63 chars)")
	}

	return nil
}

// isValidNamespaceName checks if the name is a valid Kubernetes namespace name.
func isValidNamespaceName(name string) bool {
	if len(name) == 0 || len(name) > 63 {
		return false
	}

	for i, c := range name {
		if c >= 'a' && c <= 'z' {
			continue
		}
		if c >= '0' && c <= '9' {
			continue
		}
		if c == '-' && i > 0 && i < len(name)-1 {
			continue
		}
		return false
	}

	return true
}

// ToMap converts the Config to a map for storage.
func (c *Config) ToMap() map[string]interface{} {
	result := make(map[string]interface{})

	if c.Kubeconfig != "" {
		result["kubeconfig"] = c.Kubeconfig
	}
	if c.Context != "" {
		result["context"] = c.Context
	}
	result["namespace"] = c.Namespace

	if c.StorageClassName != "" {
		result["storageClassName"] = c.StorageClassName
	}
	if c.SharedDataPVC != "" {
		result["sharedDataPVC"] = c.SharedDataPVC
	}
	if c.FreqtradeImage != "" {
		result["freqtradeImage"] = c.FreqtradeImage
	}
	if c.PrometheusURL != "" {
		result["prometheusUrl"] = c.PrometheusURL
	}
	if c.DefaultResources != nil {
		resources := make(map[string]interface{})
		if c.DefaultResources.CPURequest != "" {
			resources["cpuRequest"] = c.DefaultResources.CPURequest
		}
		if c.DefaultResources.CPULimit != "" {
			resources["cpuLimit"] = c.DefaultResources.CPULimit
		}
		if c.DefaultResources.MemoryRequest != "" {
			resources["memoryRequest"] = c.DefaultResources.MemoryRequest
		}
		if c.DefaultResources.MemoryLimit != "" {
			resources["memoryLimit"] = c.DefaultResources.MemoryLimit
		}
		if len(resources) > 0 {
			result["defaultResources"] = resources
		}
	}

	return result
}

// GetFreqtradeImage returns the Freqtrade image to use, with optional version override.
func (c *Config) GetFreqtradeImage(version string) string {
	if version != "" {
		return fmt.Sprintf("freqtradeorg/freqtrade:%s", version)
	}
	return c.FreqtradeImage
}
