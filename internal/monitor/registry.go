package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"go.uber.org/zap"
	"volaticloud/internal/etcd"
	"volaticloud/internal/logger"

	clientv3 "go.etcd.io/etcd/client/v3"
)

const (
	// InstancePrefix is the etcd key prefix for all instances
	InstancePrefix = "/volaticloud/instances/"

	// DefaultLeaseTTL is the default TTL for instance leases in seconds
	DefaultLeaseTTL = 15

	// DefaultHeartbeatInterval is how often to send heartbeats
	DefaultHeartbeatInterval = 10 * time.Second
)

// InstanceInfo holds metadata about an volaticloud instance
type InstanceInfo struct {
	// InstanceID is a unique identifier for this instance
	InstanceID string `json:"instance_id"`

	// Hostname of the server running this instance
	Hostname string `json:"hostname"`

	// StartedAt is when this instance started
	StartedAt time.Time `json:"started_at"`

	// LastHeartbeat is the last time a heartbeat was sent
	LastHeartbeat time.Time `json:"last_heartbeat"`
}

// Registry manages instance registration and discovery in etcd
type Registry struct {
	etcdClient *etcd.Client
	info       InstanceInfo
	leaseID    clientv3.LeaseID
	leaseTTL   int64

	heartbeatInterval time.Duration
	stopChan          chan struct{}
	doneChan          chan struct{}
}

// NewRegistry creates a new instance registry
func NewRegistry(etcdClient *etcd.Client, instanceID string) (*Registry, error) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	return &Registry{
		etcdClient: etcdClient,
		info: InstanceInfo{
			InstanceID:    instanceID,
			Hostname:      hostname,
			StartedAt:     time.Now(),
			LastHeartbeat: time.Now(),
		},
		leaseTTL:          DefaultLeaseTTL,
		heartbeatInterval: DefaultHeartbeatInterval,
		stopChan:          make(chan struct{}),
		doneChan:          make(chan struct{}),
	}, nil
}

// Start registers the instance and begins heartbeat loop
func (r *Registry) Start(ctx context.Context) error {
	ctx = logger.WithComponent(ctx, "monitor.registry")
	log := logger.GetLogger(ctx)

	// Grant lease
	leaseID, err := r.etcdClient.GrantLease(ctx, r.leaseTTL)
	if err != nil {
		return fmt.Errorf("failed to grant lease: %w", err)
	}
	r.leaseID = leaseID

	// Register instance
	if err := r.register(ctx); err != nil {
		return fmt.Errorf("failed to register instance: %w", err)
	}

	log.Info("Instance registered",
		zap.String("instance_id", r.info.InstanceID),
		zap.String("hostname", r.info.Hostname))

	// Start heartbeat loop
	go r.heartbeatLoop(ctx)

	return nil
}

// Stop deregisters the instance and stops heartbeats
func (r *Registry) Stop(ctx context.Context) error {
	ctx = logger.WithComponent(ctx, "monitor.registry")
	log := logger.GetLogger(ctx)

	close(r.stopChan)
	<-r.doneChan

	// Revoke lease (automatically removes instance key)
	if r.leaseID != 0 {
		if err := r.etcdClient.RevokeLease(ctx, r.leaseID); err != nil {
			log.Error("Failed to revoke lease", zap.Error(err))
		}
	}

	log.Info("Instance deregistered", zap.String("instance_id", r.info.InstanceID))
	return nil
}

// GetInstanceID returns the current instance ID
func (r *Registry) GetInstanceID() string {
	return r.info.InstanceID
}

// ListInstances returns all registered instances
func (r *Registry) ListInstances(ctx context.Context) ([]InstanceInfo, error) {
	kvs, err := r.etcdClient.GetWithPrefix(ctx, InstancePrefix)
	if err != nil {
		return nil, fmt.Errorf("failed to list instances: %w", err)
	}

	instances := make([]InstanceInfo, 0, len(kvs))
	for _, value := range kvs {
		var info InstanceInfo
		if err := json.Unmarshal([]byte(value), &info); err != nil {
			log := logger.GetLogger(ctx)
			log.Error("Failed to unmarshal instance info", zap.Error(err))
			continue
		}
		instances = append(instances, info)
	}

	return instances, nil
}

// WatchInstances watches for instance changes (joins/leaves)
// Returns a channel that sends the updated list of instance IDs whenever there's a change
func (r *Registry) WatchInstances(ctx context.Context) (<-chan []string, error) {
	instancesChan := make(chan []string)

	// Get initial list
	instances, err := r.ListInstances(ctx)
	if err != nil {
		return nil, err
	}

	initialIDs := make([]string, len(instances))
	for i, inst := range instances {
		initialIDs[i] = inst.InstanceID
	}

	// Send initial list
	go func() {
		select {
		case instancesChan <- initialIDs:
		case <-ctx.Done():
			return
		}
	}()

	// Watch for changes
	watchChan := r.etcdClient.Watch(ctx, InstancePrefix, clientv3.WithPrefix())

	go func() {
		defer close(instancesChan)

		for {
			select {
			case <-ctx.Done():
				return
			case watchResp, ok := <-watchChan:
				if !ok {
					return
				}

				if watchResp.Err() != nil {
					log := logger.GetLogger(ctx)
					log.Error("Watch error", zap.Error(watchResp.Err()))
					continue
				}

				// Get updated list
				instances, err := r.ListInstances(ctx)
				if err != nil {
					log := logger.GetLogger(ctx)
					log.Error("Failed to list instances after watch event", zap.Error(err))
					continue
				}

				instanceIDs := make([]string, len(instances))
				for i, inst := range instances {
					instanceIDs[i] = inst.InstanceID
				}

				select {
				case instancesChan <- instanceIDs:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return instancesChan, nil
}

// register registers this instance in etcd
func (r *Registry) register(ctx context.Context) error {
	r.info.LastHeartbeat = time.Now()

	data, err := json.Marshal(r.info)
	if err != nil {
		return fmt.Errorf("failed to marshal instance info: %w", err)
	}

	key := r.instanceKey()
	return r.etcdClient.PutWithLease(ctx, key, string(data), r.leaseID)
}

// heartbeatLoop maintains the instance registration via lease keep-alive
func (r *Registry) heartbeatLoop(ctx context.Context) {
	ctx = logger.WithComponent(ctx, "monitor.registry.heartbeat")
	log := logger.GetLogger(ctx)
	defer close(r.doneChan)

	// Start keep-alive
	keepAliveChan, err := r.etcdClient.KeepAlive(ctx, r.leaseID)
	if err != nil {
		log.Error("Failed to start keep-alive", zap.Error(err))
		return
	}

	ticker := time.NewTicker(r.heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-r.stopChan:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Update instance info with latest heartbeat time
			r.info.LastHeartbeat = time.Now()
			if err := r.register(ctx); err != nil {
				log.Error("Failed to update heartbeat", zap.Error(err))
			}
		case _, ok := <-keepAliveChan:
			if !ok {
				log.Warn("Keep-alive channel closed, re-establishing lease")
				// Lease expired or lost connection, try to re-register
				if err := r.reestablishLease(ctx); err != nil {
					log.Error("Failed to re-establish lease", zap.Error(err))
					return
				}
				// Restart keep-alive
				keepAliveChan, err = r.etcdClient.KeepAlive(ctx, r.leaseID)
				if err != nil {
					log.Error("Failed to restart keep-alive", zap.Error(err))
					return
				}
			}
			// If keepalive response received, lease renewed successfully (no action needed)
		}
	}
}

// reestablishLease creates a new lease and re-registers the instance
func (r *Registry) reestablishLease(ctx context.Context) error {
	leaseID, err := r.etcdClient.GrantLease(ctx, r.leaseTTL)
	if err != nil {
		return fmt.Errorf("failed to grant new lease: %w", err)
	}

	r.leaseID = leaseID
	return r.register(ctx)
}

// instanceKey returns the etcd key for this instance
func (r *Registry) instanceKey() string {
	return InstancePrefix + r.info.InstanceID
}

// GenerateInstanceID generates a unique instance ID based on hostname and timestamp
func GenerateInstanceID() string {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	// Remove any dots or slashes from hostname
	hostname = strings.ReplaceAll(hostname, ".", "-")
	hostname = strings.ReplaceAll(hostname, "/", "-")

	// Add nanosecond timestamp to ensure uniqueness even when starting multiple instances simultaneously
	timestamp := time.Now().UnixNano()

	return fmt.Sprintf("%s-%d", hostname, timestamp)
}
