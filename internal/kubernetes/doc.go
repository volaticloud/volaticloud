// Package kubernetes provides Kubernetes container runtime implementations for the runner interfaces.
//
// This package contains the Kubernetes-specific implementations of the runner.Runtime and
// runner.BacktestRunner interfaces, along with Kubernetes configuration, resource management,
// and pod lifecycle operations.
//
// # Architecture
//
// ```mermaid
// graph TB
//
//	subgraph runner["internal/runner (Abstractions)"]
//	    RT[Runtime Interface]
//	    BT[BacktestRunner Interface]
//	    Types[BotSpec, BotStatus, etc.]
//	    Factory[Factory]
//	end
//
//	subgraph kubernetes["internal/kubernetes (Implementation)"]
//	    KR[KubernetesRuntime]
//	    KBR[KubernetesBacktestRunner]
//	    CFG[Config]
//	    RES[Resource Builders]
//	    MET[Metrics Collector]
//	end
//
//	subgraph k8s["Kubernetes Resources"]
//	    DEP[Deployment]
//	    SVC[Service]
//	    JOB[Job]
//	    CM[ConfigMap]
//	    SEC[Secret]
//	    PVC[PersistentVolumeClaim]
//	end
//
//	RT --> KR
//	BT --> KBR
//	Factory --> KR
//	Factory --> KBR
//	KR --> RES
//	KBR --> RES
//	KR --> MET
//	KBR --> MET
//	RES --> DEP
//	RES --> SVC
//	RES --> JOB
//	RES --> CM
//	RES --> SEC
//	RES --> PVC
//
// ```
//
// # Components
//
// KubernetesRuntime implements runner.Runtime interface for managing bot Deployments:
//   - Deployment lifecycle (create, scale, delete)
//   - Service management for API access
//   - Real-time log streaming via Pod Logs API
//   - Resource metrics collection via Metrics API + Prometheus
//   - Health monitoring via Deployment status
//
// KubernetesBacktestRunner implements runner.BacktestRunner interface for backtesting:
//   - Job-based backtest execution (run-to-completion)
//   - HyperOpt parallel optimization
//   - Result parsing from Pod filesystem
//   - Shared data volume management via PVC
//
// Config holds Kubernetes cluster connection and configuration:
//   - Kubeconfig path (or in-cluster config)
//   - Namespace for resources
//   - Storage class for PVCs
//   - Prometheus URL for metrics
//
// # Kubernetes Resource Mapping
//
// Bots (long-running):
//   - Deployment (replicas=1) for container lifecycle
//   - Service (ClusterIP) for stable API access
//   - ConfigMap for strategy and bot configs
//   - Secret for exchange credentials
//
// Backtests (one-time tasks):
//   - Job with TTL for auto-cleanup
//   - ConfigMap for config and strategy
//   - PVC mount for shared historical data
//
// # Usage
//
//	config, err := kubernetes.ParseConfig(configData)
//	if err != nil {
//	    return err
//	}
//
//	runtime, err := kubernetes.NewRuntime(ctx, config)
//	if err != nil {
//	    return err
//	}
//
//	// Use runtime to manage bot deployments
//	err = runtime.CreateBot(ctx, botSpec)
//
// # Metrics Collection
//
// The runtime collects metrics from two sources:
//
//   - Metrics API: CPU and memory usage
//
//   - Prometheus (cAdvisor): Network and disk I/O for billing
//
//     status, err := runtime.GetBotStatus(ctx, botID)
//     // status.CPUUsage, status.MemoryUsage (from Metrics API)
//     // status.NetworkRxBytes, status.BlockReadBytes (from Prometheus)
//
// # Prerequisites
//
//   - Kubernetes Metrics Server installed
//   - Prometheus with cAdvisor metrics (for network/disk I/O)
//   - RWX-capable StorageClass (NFS/EFS/Longhorn) for shared data
//   - RBAC permissions for deployments, jobs, pods, configmaps, secrets, services, pvcs
package kubernetes
