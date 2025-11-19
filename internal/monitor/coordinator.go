package monitor

import (
	"context"
	"fmt"
	"hash/fnv"
	"sort"
	"sync"

	"go.uber.org/zap"
	"volaticloud/internal/logger"
)

// Coordinator manages bot assignment across multiple instances using consistent hashing
type Coordinator struct {
	registry *Registry

	// Current instance ID
	instanceID string

	// Cached instance list (sorted)
	mu        sync.RWMutex
	instances []string

	// Channel to signal assignment changes
	assignmentChangeChan chan struct{}
}

// NewCoordinator creates a new bot assignment coordinator
func NewCoordinator(registry *Registry) *Coordinator {
	return &Coordinator{
		registry:             registry,
		instanceID:           registry.GetInstanceID(),
		instances:            []string{registry.GetInstanceID()},
		assignmentChangeChan: make(chan struct{}, 1),
	}
}

// Start begins watching for instance changes and updating assignments
func (c *Coordinator) Start(ctx context.Context) error {
	// Watch for instance changes
	instancesChan, err := c.registry.WatchInstances(ctx)
	if err != nil {
		return fmt.Errorf("failed to watch instances: %w", err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case instanceIDs, ok := <-instancesChan:
				if !ok {
					return
				}

				c.updateInstances(instanceIDs)
			}
		}
	}()

	return nil
}

// ShouldMonitor determines if this instance should monitor the given bot
// Uses consistent hashing: hash(botID) % totalInstances == currentInstanceIndex
func (c *Coordinator) ShouldMonitor(botID string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if len(c.instances) == 0 {
		return false
	}

	// Single instance - monitor everything
	if len(c.instances) == 1 {
		return true
	}

	// Consistent hashing
	assignedInstance := c.getAssignedInstance(botID)
	return assignedInstance == c.instanceID
}

// GetAssignedBots returns all bots that should be monitored by this instance
// from the given list of all bot IDs
func (c *Coordinator) GetAssignedBots(allBotIDs []string) []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if len(c.instances) == 0 {
		return nil
	}

	// Single instance - monitor all bots
	if len(c.instances) == 1 {
		return allBotIDs
	}

	assigned := make([]string, 0, len(allBotIDs))
	for _, botID := range allBotIDs {
		if c.getAssignedInstance(botID) == c.instanceID {
			assigned = append(assigned, botID)
		}
	}

	return assigned
}

// AssignmentChanges returns a channel that signals when bot assignments may have changed
// (e.g., when instances join or leave)
func (c *Coordinator) AssignmentChanges() <-chan struct{} {
	return c.assignmentChangeChan
}

// GetInstanceCount returns the current number of registered instances
func (c *Coordinator) GetInstanceCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.instances)
}

// updateInstances updates the cached instance list and signals assignment changes
func (c *Coordinator) updateInstances(instanceIDs []string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Sort instances for consistent hashing
	sortedInstances := make([]string, len(instanceIDs))
	copy(sortedInstances, instanceIDs)
	sort.Strings(sortedInstances)

	// Check if instances actually changed
	if !instancesEqual(c.instances, sortedInstances) {
		oldCount := len(c.instances)
		c.instances = sortedInstances

		log := logger.NewProductionLogger()
		defer func() { _ = log.Sync() }()
		log.Info("Instance list updated",
			zap.Int("instance_count", len(c.instances)),
			zap.Int("previous_count", oldCount),
			zap.Strings("instances", c.instances))

		// Signal assignment change (non-blocking)
		select {
		case c.assignmentChangeChan <- struct{}{}:
		default:
			// Channel already has a pending signal
		}
	}
}

// getAssignedInstance returns the instance ID that should monitor the given bot
// Must be called with read lock held
func (c *Coordinator) getAssignedInstance(botID string) string {
	if len(c.instances) == 0 {
		return ""
	}

	// Hash the bot ID
	h := fnv.New64a()
	h.Write([]byte(botID))
	hash := h.Sum64()

	// Consistent hashing: hash % instanceCount
	index := int(hash % uint64(len(c.instances)))
	return c.instances[index]
}

// GetAssignmentStats returns statistics about bot assignment distribution
func (c *Coordinator) GetAssignmentStats(allBotIDs []string) map[string]int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	stats := make(map[string]int)
	for _, instanceID := range c.instances {
		stats[instanceID] = 0
	}

	for _, botID := range allBotIDs {
		assignedInstance := c.getAssignedInstance(botID)
		stats[assignedInstance]++
	}

	return stats
}

// instancesEqual checks if two instance lists are equal (assumes both are sorted)
func instancesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}
