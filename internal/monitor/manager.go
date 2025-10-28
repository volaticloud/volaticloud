package monitor

import (
	"context"
	"fmt"
	"log"
	"time"

	"anytrade/internal/ent"
	"anytrade/internal/etcd"
)

// Manager manages all monitoring workers and coordinates distributed monitoring
type Manager struct {
	dbClient   *ent.Client
	etcdClient *etcd.Client

	registry    *Registry
	coordinator *Coordinator
	botMonitor  *BotMonitor

	instanceID string
	enabled    bool
}

// Config holds configuration for the monitor manager
type Config struct {
	// DatabaseClient for querying and updating bots
	DatabaseClient *ent.Client

	// EtcdEndpoints is the list of etcd server endpoints
	// If empty, etcd integration is disabled (single instance mode)
	EtcdEndpoints []string

	// InstanceID is a unique identifier for this instance
	// If empty, one will be generated
	InstanceID string

	// MonitorInterval is how often to check bot status
	// Default: 30s
	MonitorInterval time.Duration

	// HeartbeatInterval is how often to send heartbeats to etcd
	// Default: 10s
	HeartbeatInterval time.Duration

	// LeaseTTL is the TTL for etcd leases in seconds
	// Default: 15s
	LeaseTTL int64
}

// NewManager creates a new monitor manager
func NewManager(cfg Config) (*Manager, error) {
	if cfg.DatabaseClient == nil {
		return nil, fmt.Errorf("database client is required")
	}

	// Generate instance ID if not provided
	if cfg.InstanceID == "" {
		cfg.InstanceID = GenerateInstanceID()
	}

	m := &Manager{
		dbClient:   cfg.DatabaseClient,
		instanceID: cfg.InstanceID,
		enabled:    len(cfg.EtcdEndpoints) > 0,
	}

	// If etcd is configured, set up distributed monitoring
	if m.enabled {
		// Create etcd client
		etcdClient, err := etcd.NewClient(etcd.Config{
			Endpoints: cfg.EtcdEndpoints,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create etcd client: %w", err)
		}
		m.etcdClient = etcdClient

		// Create registry
		registry, err := NewRegistry(etcdClient, cfg.InstanceID)
		if err != nil {
			etcdClient.Close()
			return nil, fmt.Errorf("failed to create registry: %w", err)
		}

		// Apply custom settings
		if cfg.HeartbeatInterval > 0 {
			registry.heartbeatInterval = cfg.HeartbeatInterval
		}
		if cfg.LeaseTTL > 0 {
			registry.leaseTTL = cfg.LeaseTTL
		}

		m.registry = registry

		// Create coordinator
		m.coordinator = NewCoordinator(registry)
	} else {
		// Single instance mode - create a simple coordinator that monitors all bots
		log.Println("etcd not configured - running in single-instance mode")
		m.coordinator = &Coordinator{
			instanceID: cfg.InstanceID,
			instances:  []string{cfg.InstanceID},
		}
	}

	// Create bot monitor
	m.botMonitor = NewBotMonitor(cfg.DatabaseClient, m.coordinator)
	if cfg.MonitorInterval > 0 {
		m.botMonitor.SetInterval(cfg.MonitorInterval)
	}

	return m, nil
}

// Start starts all monitoring workers
func (m *Manager) Start(ctx context.Context) error {
	log.Printf("Starting monitor manager (instance: %s, distributed: %v)", m.instanceID, m.enabled)

	// Start registry and coordinator if using etcd
	if m.enabled {
		// Start registry (registers instance and begins heartbeats)
		if err := m.registry.Start(ctx); err != nil {
			return fmt.Errorf("failed to start registry: %w", err)
		}

		// Start coordinator (watches for instance changes)
		if err := m.coordinator.Start(ctx); err != nil {
			m.registry.Stop(ctx)
			return fmt.Errorf("failed to start coordinator: %w", err)
		}

		// Wait a bit for initial instance list to be populated
		time.Sleep(1 * time.Second)
	}

	// Start bot monitor
	if err := m.botMonitor.Start(ctx); err != nil {
		if m.enabled {
			m.registry.Stop(ctx)
		}
		return fmt.Errorf("failed to start bot monitor: %w", err)
	}

	log.Println("Monitor manager started successfully")
	return nil
}

// Stop stops all monitoring workers
func (m *Manager) Stop(ctx context.Context) error {
	log.Println("Stopping monitor manager...")

	// Stop bot monitor
	m.botMonitor.Stop()

	// Stop registry if using etcd
	if m.enabled {
		if err := m.registry.Stop(ctx); err != nil {
			log.Printf("Error stopping registry: %v", err)
		}

		if err := m.etcdClient.Close(); err != nil {
			log.Printf("Error closing etcd client: %v", err)
		}
	}

	log.Println("Monitor manager stopped")
	return nil
}

// GetInstanceID returns the current instance ID
func (m *Manager) GetInstanceID() string {
	return m.instanceID
}

// IsDistributed returns true if running in distributed mode (etcd enabled)
func (m *Manager) IsDistributed() bool {
	return m.enabled
}

// GetInstanceCount returns the current number of instances
func (m *Manager) GetInstanceCount() int {
	if m.coordinator != nil {
		return m.coordinator.GetInstanceCount()
	}
	return 1
}

// GetRegistry returns the instance registry (nil if not in distributed mode)
func (m *Manager) GetRegistry() *Registry {
	return m.registry
}

// GetCoordinator returns the bot assignment coordinator
func (m *Manager) GetCoordinator() *Coordinator {
	return m.coordinator
}