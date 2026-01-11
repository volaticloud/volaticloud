// Package organization provides organization management business logic
// Following DDD pattern - keeps GraphQL resolvers thin
package organization

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"volaticloud/internal/graph/model"
	"volaticloud/internal/keycloak"
)

// GetGroupTree fetches the hierarchical group tree for an organization
// Returns the full tree with resource groups (inactive) and role subgroups (active)
func GetGroupTree(ctx context.Context, adminClient *keycloak.AdminClient, organizationID string) (*model.GroupNode, error) {
	if adminClient == nil {
		return nil, fmt.Errorf("admin client not available")
	}

	// Get group tree from Keycloak
	tree, err := adminClient.GetGroupTree(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch group tree: %w", err)
	}

	// Convert keycloak.GroupNode to model.GroupNode
	return convertGroupNode(tree), nil
}

// GetGroupMembers fetches users from a specific group (non-recursive)
// Used when user selects a role group in the tree navigation
func GetGroupMembers(ctx context.Context, adminClient *keycloak.AdminClient, groupID string) ([]*model.OrganizationUser, error) {
	if adminClient == nil {
		return nil, fmt.Errorf("admin client not available")
	}

	// Get group members (non-recursive)
	kcUsers, err := adminClient.GetGroupMembers(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch group members: %w", err)
	}

	// Convert keycloak.OrganizationUser to model.OrganizationUser
	users := make([]*model.OrganizationUser, len(kcUsers))
	for i, kcUser := range kcUsers {
		// Parse Keycloak user ID (UUID string) to uuid.UUID
		userID, err := uuid.Parse(kcUser.ID)
		if err != nil {
			return nil, fmt.Errorf("invalid user ID format for user %s: %w", kcUser.Username, err)
		}

		users[i] = &model.OrganizationUser{
			ID:            userID,
			Username:      kcUser.Username,
			Email:         &kcUser.Email,
			EmailVerified: kcUser.EmailVerified,
			FirstName:     &kcUser.FirstName,
			LastName:      &kcUser.LastName,
			Enabled:       kcUser.Enabled,
			CreatedAt:     time.UnixMilli(kcUser.CreatedAt),
		}
	}

	return users, nil
}

// convertGroupNode recursively converts keycloak.GroupNode to model.GroupNode
func convertGroupNode(node *keycloak.GroupNode) *model.GroupNode {
	if node == nil {
		return nil
	}

	// Parse group ID to UUID
	groupID, err := uuid.Parse(node.ID)
	if err != nil {
		// If ID is invalid, return nil (shouldn't happen with Keycloak UUIDs)
		log.Printf("Warning: skipping group node with invalid UUID: %s (name: %s, path: %s) - %v",
			node.ID, node.Name, node.Path, err)
		return nil
	}

	modelNode := &model.GroupNode{
		ID:    groupID,
		Name:  node.Name,
		Path:  node.Path,
		Type:  node.Type,
		Title: node.Title,
	}

	// Convert children
	modelNode.Children = make([]*model.GroupNode, len(node.Children))
	for i, child := range node.Children {
		modelNode.Children[i] = convertGroupNode(child)
	}

	return modelNode
}
