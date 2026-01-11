/*
Package organization provides organization and user management functionality through Keycloak integration.

# Architecture Overview

The organization package implements thin wrappers around Keycloak Admin API calls and custom extension
endpoints for managing organization hierarchies, resource groups, and user memberships.

```mermaid
flowchart TB

	subgraph GraphQL["GraphQL Layer"]
	    R[Query Resolvers<br/>OrganizationGroupTree<br/>GroupMembers<br/>ResourceGroups<br/>ResourceGroupMembers]
	end

	subgraph Organization["Organization Package (Domain Logic)"]
	    GGT[GetGroupTree]
	    GM[GetGroupMembers]
	    GRG[GetResourceGroups]
	    GRGM[GetResourceGroupMembers]
	    BRC[buildResourceGroupConnection]
	    BRMC[buildResourceGroupMemberConnection]
	    CGN[convertGroupNode]
	end

	subgraph Keycloak["Keycloak Admin Client"]
	    GT[GetGroupTree<br/>Admin API]
	    GMEM[GetGroupMembers<br/>Admin API]
	    EXT[GetResourceGroups<br/>GetResourceGroupMembers<br/>Extension Endpoints]
	end

	R --> GGT
	R --> GM
	R --> GRG
	R --> GRGM
	GGT --> GT
	GM --> GMEM
	GRG --> EXT
	GRGM --> EXT
	GRG --> BRC
	GRGM --> BRMC
	GGT --> CGN

```

# Component Responsibilities

GetGroupTree:
  - Fetches hierarchical group structure from Keycloak
  - Includes resource groups and role groups
  - Used for tree navigation in dashboard sidebar
  - Returns nested GroupNode structure with type metadata

GetGroupMembers:
  - Fetches all members of a specific group
  - Used when selecting a role group in the tree
  - Returns flat list of OrganizationUser

GetResourceGroups:
  - Fetches paginated, searchable resource groups (thin wrapper)
  - Calls Keycloak extension endpoint for server-side filtering/sorting
  - Supports search by title, ordering by title or total members
  - Returns GraphQL Connection with pagination metadata

GetResourceGroupMembers:
  - Fetches paginated, searchable members of a resource group
  - Calls Keycloak extension endpoint for server-side filtering/sorting
  - Supports filtering by roles, enabled status, email verification
  - Supports ordering by username, email, firstName, lastName, createdAt, primaryRole
  - Returns GraphQL Connection with pagination metadata

# Keycloak Extension Integration

The package delegates to custom Keycloak REST endpoints that provide pre-normalized data:

Extension Endpoints:
  - GET /realms/{realm}/volaticloud/organizations/{orgId}/resource-groups
  - GET /realms/{realm}/volaticloud/organizations/{orgId}/resource-groups/{resourceId}/members

Benefits:
  - Server-side filtering, sorting, pagination (reduces N+1 problem)
  - Pre-normalized role information (no need to traverse subgroups)
  - Efficient member count aggregation
  - Reduced network overhead

# Authorization

All GraphQL queries use @hasScope directive with "view-users" scope:
  - organizationGroupTree: @hasScope(resource: "organizationId", scope: "view-users")
  - groupMembers: @hasScope(resource: "organizationId", scope: "view-users")
  - resourceGroups: @hasScope(resource: "organizationId", scope: "view-users")
  - resourceGroupMembers: @hasScope(resource: "organizationId", scope: "view-users")

Authorization is verified before any Keycloak calls are made.

# Data Model

GroupNode:
  - Represents a node in the hierarchical group tree
  - Type: "resource" or "role"
  - Resource groups have role subgroups (role:admin, role:viewer)
  - Used for tree navigation UI

ResourceGroup:
  - Flat representation of a resource with aggregated role data
  - Includes role member counts and total member count
  - Optimized for table/list views with pagination

ResourceGroupMember:
  - User membership in a resource group with role information
  - Includes all roles assigned to the user
  - PrimaryRole determined by priority: owner > admin > editor > viewer
  - Supports filtering and sorting on user attributes

# Usage Examples

Get organization group tree:

	adminClient := GetAdminClientFromContext(ctx)
	tree, err := organization.GetGroupTree(ctx, adminClient, organizationID)
	if err != nil {
	    return nil, err
	}
	// tree is a *model.GroupNode with nested Children

Get members of a specific group:

	adminClient := GetAdminClientFromContext(ctx)
	members, err := organization.GetGroupMembers(ctx, adminClient, groupID)
	if err != nil {
	    return nil, err
	}
	// members is []*model.OrganizationUser

Get paginated resource groups with search:

	where := &model.ResourceGroupWhereInput{
	    TitleContainsFold: &searchTerm,
	}
	orderBy := &model.ResourceGroupOrder{
	    Field: model.ResourceGroupOrderFieldTitle,
	    Direction: model.OrderDirectionAsc,
	}
	connection, err := organization.GetResourceGroups(
	    ctx, adminClient, orgID, where, orderBy, 20, 0,
	)
	// connection.Edges contains resource groups with role info
	// connection.PageInfo contains pagination metadata

Get paginated resource group members with filters:

	where := &model.ResourceGroupMemberWhereInput{
	    RoleIn: []string{"admin", "editor"},
	    Enabled: &trueValue,
	    SearchContainsFold: &searchTerm,
	}
	orderBy := &model.ResourceGroupMemberOrder{
	    Field: model.ResourceGroupMemberOrderFieldUsername,
	    Direction: model.OrderDirectionAsc,
	}
	connection, err := organization.GetResourceGroupMembers(
	    ctx, adminClient, orgID, resourceGroupID, where, orderBy, 50, 0,
	)
	// connection.Edges contains members with user details and roles
	// connection.PageInfo contains pagination metadata

# Design Principles

Thin Wrapper Pattern:
  - Organization package does NOT contain complex business logic
  - Delegates heavy lifting to Keycloak extension endpoints
  - Focuses on data transformation (Keycloak → GraphQL types)
  - Follows DDD principle: minimal GraphQL→Domain→External service

Parameter Extraction:
  - Extracts filter/order parameters from GraphQL inputs
  - Converts to Keycloak endpoint query parameters
  - Handles nil-safe defaults for optional inputs

Connection Building:
  - Converts Keycloak responses to GraphQL Connection pattern
  - Builds PageInfo with cursors for efficient pagination
  - Validates UUIDs and skips invalid entries

# Error Handling

Invalid UUIDs:
  - Silently skipped during conversion (logged in production)
  - Prevents crashes from malformed Keycloak data
  - Allows partial results to be returned

Nil Client:
  - Returns error immediately if adminClient is nil
  - Prevents NPE and provides clear error messages
  - Client injection handled by GraphQL middleware

Keycloak Errors:
  - Wrapped with context ("failed to fetch resource groups: ...")
  - Propagated to GraphQL resolver layer
  - Shown to user with appropriate error message

# Performance Considerations

Keycloak Extension Optimization:
  - Single HTTP call per query (vs N+1 for manual traversal)
  - Server-side filtering reduces data transfer
  - Server-side pagination limits memory usage
  - Pre-aggregated member counts avoid repeated queries

Cursor-Based Pagination:
  - Uses UUID cursors for stable pagination
  - Works with offset-based Keycloak responses
  - Supports forward pagination efficiently

Connection Reuse:
  - AdminClient injected via context (singleton per request)
  - Reuses Keycloak auth token across multiple calls
  - Reduces authentication overhead

# Testing

The package includes comprehensive unit tests for:
  - Nil client error handling
  - Connection building with various data shapes
  - UUID validation and invalid entry skipping
  - Pagination boundary conditions

See groups_test.go and users_test.go for test coverage.

# Future Enhancements

Planned:
  - Role assignment mutations (add/remove users from roles)
  - User invitation flow (create accounts, send invites)
  - Organization creation/deletion
  - Group hierarchy modifications

Not Planned (Keycloak Admin Console):
  - Full user management (handled by Keycloak directly)
  - Complex role hierarchy management
  - Permission delegation
*/
package organization