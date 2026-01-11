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

func TestGetResourceGroups_NilClient(t *testing.T) {
	ctx := context.Background()
	testUUID := uuid.New().String()

	result, err := GetResourceGroups(ctx, nil, testUUID, nil, nil, 20, 0)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "admin client not available")
	assert.Nil(t, result)
}

func TestGetResourceGroupMembers_NilClient(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New().String()
	groupID := uuid.New().String()

	result, err := GetResourceGroupMembers(ctx, nil, orgID, groupID, nil, nil, 50, 0)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "admin client not available")
	assert.Nil(t, result)
}

func TestBuildResourceGroupConnection(t *testing.T) {
	tests := []struct {
		name     string
		response *keycloak.ResourceGroupListResponse
		first    int
		offset   int
		validate func(t *testing.T, result *model.ResourceGroupConnection)
	}{
		{
			name: "empty response",
			response: &keycloak.ResourceGroupListResponse{
				TotalCount: 0,
				HasMore:    false,
				Items:      []keycloak.ResourceGroupRepresentation{},
			},
			first:  20,
			offset: 0,
			validate: func(t *testing.T, result *model.ResourceGroupConnection) {
				assert.Equal(t, 0, result.TotalCount)
				assert.Len(t, result.Edges, 0)
				assert.Nil(t, result.PageInfo.StartCursor)
				assert.Nil(t, result.PageInfo.EndCursor)
				assert.False(t, result.PageInfo.HasNextPage)
				assert.False(t, result.PageInfo.HasPreviousPage)
			},
		},
		{
			name: "single item with valid UUID name",
			response: &keycloak.ResourceGroupListResponse{
				TotalCount: 1,
				HasMore:    false,
				Items: []keycloak.ResourceGroupRepresentation{
					{
						Name:         uuid.New().String(),
						Path:         "/org/test",
						Title:        "Test Group",
						Roles:        []keycloak.RoleInfo{{Name: "admin", MemberCount: 5}},
						TotalMembers: 5,
						HasChildren:  true,
					},
				},
			},
			first:  20,
			offset: 0,
			validate: func(t *testing.T, result *model.ResourceGroupConnection) {
				assert.Equal(t, 1, result.TotalCount)
				assert.Len(t, result.Edges, 1)
				assert.NotNil(t, result.PageInfo.StartCursor)
				assert.NotNil(t, result.PageInfo.EndCursor)
				assert.Equal(t, "Test Group", result.Edges[0].Node.Title)
				assert.Len(t, result.Edges[0].Node.Roles, 1)
			},
		},
		{
			name: "pagination indicators",
			response: &keycloak.ResourceGroupListResponse{
				TotalCount: 100,
				HasMore:    true,
				Items: []keycloak.ResourceGroupRepresentation{
					{
						Name:         uuid.New().String(),
						Path:         "/org/test",
						Title:        "Test",
						Roles:        []keycloak.RoleInfo{},
						TotalMembers: 0,
						HasChildren:  false,
					},
				},
			},
			first:  20,
			offset: 40,
			validate: func(t *testing.T, result *model.ResourceGroupConnection) {
				assert.True(t, result.PageInfo.HasNextPage)
				assert.True(t, result.PageInfo.HasPreviousPage)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildResourceGroupConnection(tt.response, tt.first, tt.offset)
			tt.validate(t, result)
		})
	}
}

func TestBuildResourceGroupMemberConnection(t *testing.T) {
	tests := []struct {
		name     string
		response *keycloak.ResourceGroupMemberListResponse
		first    int
		offset   int
		validate func(t *testing.T, result *model.ResourceGroupMemberConnection)
	}{
		{
			name: "empty response",
			response: &keycloak.ResourceGroupMemberListResponse{
				TotalCount: 0,
				HasMore:    false,
				Items:      []keycloak.ResourceGroupMemberRepresentation{},
			},
			first:  50,
			offset: 0,
			validate: func(t *testing.T, result *model.ResourceGroupMemberConnection) {
				assert.Equal(t, 0, result.TotalCount)
				assert.Len(t, result.Edges, 0)
				assert.Nil(t, result.PageInfo.StartCursor)
				assert.Nil(t, result.PageInfo.EndCursor)
			},
		},
		{
			name: "single valid member",
			response: &keycloak.ResourceGroupMemberListResponse{
				TotalCount: 1,
				HasMore:    false,
				Items: []keycloak.ResourceGroupMemberRepresentation{
					{
						User: keycloak.MemberUser{
							ID:               uuid.New().String(),
							Username:         "testuser",
							Email:            "test@example.com",
							EmailVerified:    true,
							FirstName:        "Test",
							LastName:         "User",
							Enabled:          true,
							CreatedTimestamp: 1704067200000,
						},
						Roles:       []string{"admin"},
						PrimaryRole: "admin",
					},
				},
			},
			first:  50,
			offset: 0,
			validate: func(t *testing.T, result *model.ResourceGroupMemberConnection) {
				assert.Equal(t, 1, result.TotalCount)
				assert.Len(t, result.Edges, 1)
				assert.Equal(t, "testuser", result.Edges[0].Node.User.Username)
				assert.NotNil(t, result.PageInfo.StartCursor)
				assert.NotNil(t, result.PageInfo.EndCursor)
			},
		},
		{
			name: "skip invalid user ID",
			response: &keycloak.ResourceGroupMemberListResponse{
				TotalCount: 2,
				HasMore:    false,
				Items: []keycloak.ResourceGroupMemberRepresentation{
					{
						User: keycloak.MemberUser{
							ID:       "invalid-uuid",
							Username: "baduser",
						},
						Roles:       []string{"viewer"},
						PrimaryRole: "viewer",
					},
					{
						User: keycloak.MemberUser{
							ID:       uuid.New().String(),
							Username: "gooduser",
						},
						Roles:       []string{"admin"},
						PrimaryRole: "admin",
					},
				},
			},
			first:  50,
			offset: 0,
			validate: func(t *testing.T, result *model.ResourceGroupMemberConnection) {
				// Should skip the invalid UUID and only include valid one
				assert.Len(t, result.Edges, 1)
				assert.Equal(t, "gooduser", result.Edges[0].Node.User.Username)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildResourceGroupMemberConnection(tt.response, tt.first, tt.offset)
			tt.validate(t, result)
		})
	}
}
