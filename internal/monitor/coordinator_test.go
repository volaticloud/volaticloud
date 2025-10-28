package monitor

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConsistentHashing(t *testing.T) {
	tests := []struct {
		name          string
		instances     []string
		botIDs        []string
		expectedDist  map[string]int
		testBotID     string
		expectedOwner string
	}{
		{
			name:      "single instance gets all bots",
			instances: []string{"instance-1"},
			botIDs:    []string{"bot-1", "bot-2", "bot-3"},
			expectedDist: map[string]int{
				"instance-1": 3,
			},
			testBotID:     "bot-1",
			expectedOwner: "instance-1",
		},
		{
			name:      "two instances split bots",
			instances: []string{"instance-1", "instance-2"},
			botIDs:    []string{"bot-1", "bot-2", "bot-3", "bot-4"},
			testBotID: "bot-1",
			// Will be determined by hash
		},
		{
			name:      "three instances distribute evenly",
			instances: []string{"instance-1", "instance-2", "instance-3"},
			botIDs:    []string{"bot-1", "bot-2", "bot-3", "bot-4", "bot-5", "bot-6"},
			// Distribution depends on hash function
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create coordinator with mock instances
			c := &Coordinator{
				instanceID: tt.instances[0],
				instances:  tt.instances,
			}

			// Test distribution
			if tt.expectedDist != nil {
				stats := c.GetAssignmentStats(tt.botIDs)
				for instanceID, expectedCount := range tt.expectedDist {
					assert.Equal(t, expectedCount, stats[instanceID],
						"Instance %s should have %d bots", instanceID, expectedCount)
				}
			}

			// Test specific bot assignment
			if tt.expectedOwner != "" {
				owner := c.getAssignedInstance(tt.testBotID)
				assert.Equal(t, tt.expectedOwner, owner,
					"Bot %s should be assigned to %s", tt.testBotID, tt.expectedOwner)
			}

			// Test GetAssignedBots
			assignedBots := c.GetAssignedBots(tt.botIDs)
			assert.NotNil(t, assignedBots)

			// Verify all bots are assigned exactly once
			allAssigned := make(map[string]bool)
			for _, instanceID := range tt.instances {
				c.instanceID = instanceID
				assigned := c.GetAssignedBots(tt.botIDs)
				for _, botID := range assigned {
					assert.False(t, allAssigned[botID],
						"Bot %s should not be assigned to multiple instances", botID)
					allAssigned[botID] = true
				}
			}

			// All bots should be assigned
			assert.Equal(t, len(tt.botIDs), len(allAssigned),
				"All bots should be assigned to exactly one instance")
		})
	}
}

func TestCoordinatorShouldMonitor(t *testing.T) {
	tests := []struct {
		name       string
		instances  []string
		instanceID string
		botID      string
		want       bool
	}{
		{
			name:       "single instance monitors all",
			instances:  []string{"instance-1"},
			instanceID: "instance-1",
			botID:      "bot-1",
			want:       true,
		},
		{
			name:       "no instances returns false",
			instances:  []string{},
			instanceID: "instance-1",
			botID:      "bot-1",
			want:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := &Coordinator{
				instanceID: tt.instanceID,
				instances:  tt.instances,
			}

			got := c.ShouldMonitor(tt.botID)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestGetInstanceCount(t *testing.T) {
	c := &Coordinator{
		instanceID: "instance-1",
		instances:  []string{"instance-1", "instance-2", "instance-3"},
	}

	count := c.GetInstanceCount()
	assert.Equal(t, 3, count)
}

func TestInstancesEqual(t *testing.T) {
	tests := []struct {
		name string
		a    []string
		b    []string
		want bool
	}{
		{
			name: "equal slices",
			a:    []string{"a", "b", "c"},
			b:    []string{"a", "b", "c"},
			want: true,
		},
		{
			name: "different lengths",
			a:    []string{"a", "b"},
			b:    []string{"a", "b", "c"},
			want: false,
		},
		{
			name: "different values",
			a:    []string{"a", "b", "c"},
			b:    []string{"a", "x", "c"},
			want: false,
		},
		{
			name: "empty slices",
			a:    []string{},
			b:    []string{},
			want: true,
		},
		{
			name: "nil vs empty",
			a:    nil,
			b:    []string{},
			want: true, // Both have length 0, so they're considered equal
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := instancesEqual(tt.a, tt.b)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestHashDistribution(t *testing.T) {
	// Test that hash function distributes bots reasonably evenly
	instances := []string{"instance-1", "instance-2", "instance-3"}
	c := &Coordinator{
		instanceID: instances[0],
		instances:  instances,
	}

	// Generate 300 bot IDs
	botIDs := make([]string, 300)
	for i := 0; i < 300; i++ {
		botIDs[i] = string(rune('a' + (i % 26))) + string(rune('a' + (i/26)%26)) + "-bot-id"
	}

	stats := c.GetAssignmentStats(botIDs)

	// Each instance should get roughly 100 bots (300 / 3)
	// Allow 30% variance
	for instanceID, count := range stats {
		assert.Greater(t, count, 70, "Instance %s should have at least 70 bots", instanceID)
		assert.Less(t, count, 130, "Instance %s should have at most 130 bots", instanceID)
	}

	// Total should equal number of bots
	total := 0
	for _, count := range stats {
		total += count
	}
	assert.Equal(t, 300, total, "Total assigned bots should equal input bots")
}