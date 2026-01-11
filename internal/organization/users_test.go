package organization

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"volaticloud/internal/graph/model"
	"volaticloud/internal/keycloak"
)

func TestGetGroupTree_NilClient(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New().String()

	tree, err := GetGroupTree(ctx, nil, orgID)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "admin client not available")
	assert.Nil(t, tree)
}

func TestGetGroupMembers_NilClient(t *testing.T) {
	ctx := context.Background()
	groupID := uuid.New().String()

	users, err := GetGroupMembers(ctx, nil, groupID)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "admin client not available")
	assert.Nil(t, users)
}

func TestConvertGroupNode(t *testing.T) {
	tests := []struct {
		name     string
		node     *keycloak.GroupNode
		validate func(t *testing.T, result *model.GroupNode)
	}{
		{
			name: "nil node returns nil",
			node: nil,
			validate: func(t *testing.T, result *model.GroupNode) {
				assert.Nil(t, result)
			},
		},
		{
			name: "simple node without children",
			node: &keycloak.GroupNode{
				ID:       uuid.New().String(),
				Name:     "test",
				Path:     "/org/test",
				Type:     "resource",
				Title:    "Test Node",
				Children: []*keycloak.GroupNode{},
			},
			validate: func(t *testing.T, result *model.GroupNode) {
				assert.NotNil(t, result)
				assert.Equal(t, "test", result.Name)
				assert.Equal(t, "Test Node", result.Title)
				assert.Equal(t, "resource", result.Type)
				assert.Len(t, result.Children, 0)
			},
		},
		{
			name: "node with children",
			node: &keycloak.GroupNode{
				ID:    uuid.New().String(),
				Name:  "parent",
				Path:  "/org/parent",
				Type:  "resource",
				Title: "Parent",
				Children: []*keycloak.GroupNode{
					{
						ID:       uuid.New().String(),
						Name:     "child1",
						Path:     "/org/parent/child1",
						Type:     "resource",
						Title:    "Child 1",
						Children: []*keycloak.GroupNode{},
					},
					{
						ID:       uuid.New().String(),
						Name:     "role:admin",
						Path:     "/org/parent/role:admin",
						Type:     "role",
						Title:    "Admin",
						Children: []*keycloak.GroupNode{},
					},
				},
			},
			validate: func(t *testing.T, result *model.GroupNode) {
				assert.NotNil(t, result)
				assert.Equal(t, "parent", result.Name)
				assert.Len(t, result.Children, 2)
				assert.Equal(t, "child1", result.Children[0].Name)
				assert.Equal(t, "role:admin", result.Children[1].Name)
				assert.Equal(t, "role", result.Children[1].Type)
			},
		},
		{
			name: "invalid UUID returns nil",
			node: &keycloak.GroupNode{
				ID:       "not-a-uuid",
				Name:     "bad",
				Path:     "/org/bad",
				Type:     "resource",
				Title:    "Bad Node",
				Children: []*keycloak.GroupNode{},
			},
			validate: func(t *testing.T, result *model.GroupNode) {
				assert.Nil(t, result)
			},
		},
		{
			name: "deeply nested hierarchy",
			node: &keycloak.GroupNode{
				ID:    uuid.New().String(),
				Name:  "root",
				Path:  "/org/root",
				Type:  "resource",
				Title: "Root",
				Children: []*keycloak.GroupNode{
					{
						ID:    uuid.New().String(),
						Name:  "level1",
						Path:  "/org/root/level1",
						Type:  "resource",
						Title: "Level 1",
						Children: []*keycloak.GroupNode{
							{
								ID:    uuid.New().String(),
								Name:  "level2",
								Path:  "/org/root/level1/level2",
								Type:  "resource",
								Title: "Level 2",
								Children: []*keycloak.GroupNode{
									{
										ID:       uuid.New().String(),
										Name:     "role:viewer",
										Path:     "/org/root/level1/level2/role:viewer",
										Type:     "role",
										Title:    "Viewer",
										Children: []*keycloak.GroupNode{},
									},
								},
							},
						},
					},
				},
			},
			validate: func(t *testing.T, result *model.GroupNode) {
				assert.NotNil(t, result)
				assert.Equal(t, "root", result.Name)
				assert.Len(t, result.Children, 1)
				assert.Equal(t, "level1", result.Children[0].Name)
				assert.Len(t, result.Children[0].Children, 1)
				assert.Equal(t, "level2", result.Children[0].Children[0].Name)
				assert.Len(t, result.Children[0].Children[0].Children, 1)
				assert.Equal(t, "role:viewer", result.Children[0].Children[0].Children[0].Name)
				assert.Equal(t, "role", result.Children[0].Children[0].Children[0].Type)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertGroupNode(tt.node)
			if tt.validate != nil {
				tt.validate(t, result)
			}
		})
	}
}
