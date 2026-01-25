package organization

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"volaticloud/internal/ent"
	"volaticloud/internal/graph/model"
	"volaticloud/internal/keycloak"
)

// GetResourceGroups fetches paginated, searchable resource groups for an organization
// This is a thin wrapper that calls the Keycloak extension endpoint
func GetResourceGroups(
	ctx context.Context,
	adminClient keycloak.AdminClientInterface,
	organizationID string,
	where *model.ResourceGroupWhereInput,
	orderBy *model.ResourceGroupOrder,
	first, offset int,
) (*model.ResourceGroupConnection, error) {
	if adminClient == nil {
		return nil, fmt.Errorf("admin client not available")
	}

	// Extract search from where clause
	search := ""
	if where != nil && where.TitleContainsFold != nil {
		search = *where.TitleContainsFold
	}

	// Extract order parameters
	orderByField := "title"
	orderDir := "asc"
	if orderBy != nil {
		orderByField = string(orderBy.Field)
		orderDir = string(orderBy.Direction)
	}

	// Call Keycloak extension endpoint
	response, err := adminClient.GetResourceGroups(
		ctx, organizationID, search, first, offset, orderByField, orderDir,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch resource groups: %w", err)
	}

	// Convert to GraphQL Connection
	return buildResourceGroupConnection(response, first, offset), nil
}

// GetResourceGroupMembers fetches paginated, searchable members for a resource group
// This is a thin wrapper that calls the Keycloak extension endpoint
func GetResourceGroupMembers(
	ctx context.Context,
	adminClient keycloak.AdminClientInterface,
	organizationID, resourceGroupID string,
	where *model.ResourceGroupMemberWhereInput,
	orderBy *model.ResourceGroupMemberOrder,
	first, offset int,
) (*model.ResourceGroupMemberConnection, error) {
	if adminClient == nil {
		return nil, fmt.Errorf("admin client not available")
	}

	// Extract filters from where clause
	var roleFilter []string
	var search string
	var enabled, emailVerified *bool

	if where != nil {
		if len(where.RoleIn) > 0 {
			roleFilter = where.RoleIn
		}
		if where.SearchContainsFold != nil {
			search = *where.SearchContainsFold
		}
		if where.Enabled != nil {
			enabled = where.Enabled
		}
		if where.EmailVerified != nil {
			emailVerified = where.EmailVerified
		}
	}

	// Extract order parameters
	orderByField := "username"
	orderDir := "asc"
	if orderBy != nil {
		orderByField = string(orderBy.Field)
		orderDir = string(orderBy.Direction)
	}

	// Call Keycloak extension endpoint
	response, err := adminClient.GetResourceGroupMembers(
		ctx, organizationID, resourceGroupID, roleFilter, search,
		enabled, emailVerified, first, offset, orderByField, orderDir,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch resource group members: %w", err)
	}

	// Convert to GraphQL Connection
	return buildResourceGroupMemberConnection(response, first, offset), nil
}

// buildResourceGroupConnection converts Keycloak response to GraphQL Connection
func buildResourceGroupConnection(
	response *keycloak.ResourceGroupListResponse,
	first, offset int,
) *model.ResourceGroupConnection {
	edges := make([]*model.ResourceGroupEdge, 0, len(response.Items))

	for i, item := range response.Items {
		// Convert roles
		roles := make([]*model.RoleInfo, len(item.Roles))
		for j, role := range item.Roles {
			roles[j] = &model.RoleInfo{
				Name:        role.Name,
				MemberCount: role.MemberCount,
			}
		}

		node := &model.ResourceGroup{
			Name:         item.Name,
			Path:         item.Path,
			Title:        item.Title,
			Type:         item.Type,
			Roles:        roles,
			TotalMembers: item.TotalMembers,
			HasChildren:  item.HasChildren,
		}

		edges = append(edges, &model.ResourceGroupEdge{
			Node:   node,
			Cursor: fmt.Sprintf("%d", offset+i),
		})
	}

	// Build PageInfo with proper cursors
	// Use resource name (our UUID) for cursor ID
	var startCursor, endCursor *ent.Cursor
	if len(edges) > 0 {
		// Parse the name (our resource UUID) for the cursor
		if startID, err := uuid.Parse(edges[0].Node.Name); err == nil {
			startCursor = &ent.Cursor{ID: startID}
		} else {
			log.Printf("Warning: invalid UUID for resource group cursor (start): %s - %v", edges[0].Node.Name, err)
		}
		if endID, err := uuid.Parse(edges[len(edges)-1].Node.Name); err == nil {
			endCursor = &ent.Cursor{ID: endID}
		} else {
			log.Printf("Warning: invalid UUID for resource group cursor (end): %s - %v", edges[len(edges)-1].Node.Name, err)
		}
	}

	return &model.ResourceGroupConnection{
		Edges:      edges,
		TotalCount: response.TotalCount,
		PageInfo: &ent.PageInfo{
			HasNextPage:     response.HasMore,
			HasPreviousPage: offset > 0,
			StartCursor:     startCursor,
			EndCursor:       endCursor,
		},
	}
}

// buildResourceGroupMemberConnection converts Keycloak response to GraphQL Connection
func buildResourceGroupMemberConnection(
	response *keycloak.ResourceGroupMemberListResponse,
	first, offset int,
) *model.ResourceGroupMemberConnection {
	edges := make([]*model.ResourceGroupMemberEdge, 0, len(response.Items))

	for i, item := range response.Items {
		// Parse user ID
		userID, err := uuid.Parse(item.User.ID)
		if err != nil {
			// Skip invalid IDs (shouldn't happen with Keycloak UUIDs)
			log.Printf("Warning: skipping resource group member with invalid UUID: %s (username: %s) - %v",
				item.User.ID, item.User.Username, err)
			continue
		}

		user := &model.MemberUser{
			ID:            userID,
			Username:      item.User.Username,
			Email:         &item.User.Email,
			EmailVerified: item.User.EmailVerified,
			FirstName:     &item.User.FirstName,
			LastName:      &item.User.LastName,
			Enabled:       item.User.Enabled,
			CreatedAt:     time.UnixMilli(item.User.CreatedTimestamp),
		}

		node := &model.ResourceGroupMember{
			User:        user,
			Roles:       item.Roles,
			PrimaryRole: item.PrimaryRole,
		}

		edges = append(edges, &model.ResourceGroupMemberEdge{
			Node:   node,
			Cursor: fmt.Sprintf("%d", offset+i),
		})
	}

	// Build PageInfo with proper cursors (using user IDs)
	var startCursor, endCursor *ent.Cursor
	if len(edges) > 0 {
		startCursor = &ent.Cursor{ID: edges[0].Node.User.ID}
		endCursor = &ent.Cursor{ID: edges[len(edges)-1].Node.User.ID}
	}

	return &model.ResourceGroupMemberConnection{
		Edges:          edges,
		TotalCount:     response.TotalCount,
		AvailableRoles: response.AvailableRoles,
		PageInfo: &ent.PageInfo{
			HasNextPage:     response.HasMore,
			HasPreviousPage: offset > 0,
			StartCursor:     startCursor,
			EndCursor:       endCursor,
		},
	}
}
