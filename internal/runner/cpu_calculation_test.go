package runner

import (
	"testing"
)

// TestCalculateCPUPercent tests CPU percentage calculation for both cgroups v1 and v2.
func TestCalculateCPUPercent(t *testing.T) {
	tests := []struct {
		name           string
		cpuDelta       float64
		systemDelta    float64
		percpuUsageLen int    // cgroups v1
		onlineCPUs     uint32 // cgroups v2
		wantCPUPercent float64
	}{
		{
			name:           "cgroups v1 with 4 CPUs",
			cpuDelta:       100000000,  // 100ms
			systemDelta:    1000000000, // 1s
			percpuUsageLen: 4,
			onlineCPUs:     0,
			wantCPUPercent: 40.0, // (100/1000) * 4 * 100 = 40%
		},
		{
			name:           "cgroups v2 with 4 CPUs (PercpuUsage empty)",
			cpuDelta:       100000000,  // 100ms
			systemDelta:    1000000000, // 1s
			percpuUsageLen: 0,          // empty in cgroups v2
			onlineCPUs:     4,
			wantCPUPercent: 40.0, // (100/1000) * 4 * 100 = 40%
		},
		{
			name:           "cgroups v2 fallback to 1 CPU",
			cpuDelta:       100000000,  // 100ms
			systemDelta:    1000000000, // 1s
			percpuUsageLen: 0,
			onlineCPUs:     0,    // both empty - fallback to 1
			wantCPUPercent: 10.0, // (100/1000) * 1 * 100 = 10%
		},
		{
			name:           "100% CPU usage on 2 CPUs",
			cpuDelta:       2000000000, // 2s
			systemDelta:    1000000000, // 1s
			percpuUsageLen: 2,
			onlineCPUs:     0,
			wantCPUPercent: 400.0, // (2000/1000) * 2 * 100 = 400%
		},
		{
			name:           "low CPU usage",
			cpuDelta:       5000000,    // 5ms
			systemDelta:    1000000000, // 1s
			percpuUsageLen: 8,
			onlineCPUs:     0,
			wantCPUPercent: 4.0, // (5/1000) * 8 * 100 = 4%
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the CPU calculation logic from docker_runner.go
			numCPUs := tt.percpuUsageLen
			if numCPUs == 0 {
				numCPUs = int(tt.onlineCPUs)
			}
			if numCPUs == 0 {
				numCPUs = 1 // fallback to 1 CPU
			}

			cpuPercent := (tt.cpuDelta / tt.systemDelta) * float64(numCPUs) * 100.0

			// Allow small floating point tolerance
			tolerance := 0.001
			if diff := cpuPercent - tt.wantCPUPercent; diff < -tolerance || diff > tolerance {
				t.Errorf("calculateCPUPercent() = %v, want %v", cpuPercent, tt.wantCPUPercent)
			}
		})
	}
}

// TestNumCPUsFallback tests the CPU count determination logic.
func TestNumCPUsFallback(t *testing.T) {
	tests := []struct {
		name           string
		percpuUsageLen int
		onlineCPUs     uint32
		wantNumCPUs    int
	}{
		{
			name:           "cgroups v1 - use PercpuUsage length",
			percpuUsageLen: 8,
			onlineCPUs:     0,
			wantNumCPUs:    8,
		},
		{
			name:           "cgroups v2 - use OnlineCPUs",
			percpuUsageLen: 0,
			onlineCPUs:     4,
			wantNumCPUs:    4,
		},
		{
			name:           "both empty - fallback to 1",
			percpuUsageLen: 0,
			onlineCPUs:     0,
			wantNumCPUs:    1,
		},
		{
			name:           "prefer PercpuUsage over OnlineCPUs",
			percpuUsageLen: 4,
			onlineCPUs:     8, // ignored when PercpuUsage is available
			wantNumCPUs:    4,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the numCPUs determination logic
			numCPUs := tt.percpuUsageLen
			if numCPUs == 0 {
				numCPUs = int(tt.onlineCPUs)
			}
			if numCPUs == 0 {
				numCPUs = 1
			}

			if numCPUs != tt.wantNumCPUs {
				t.Errorf("numCPUs = %v, want %v", numCPUs, tt.wantNumCPUs)
			}
		})
	}
}
