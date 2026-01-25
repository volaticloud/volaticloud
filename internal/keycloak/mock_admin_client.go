package keycloak

import (
	"context"
	"fmt"
	"sync"
)

// MockCall represents a recorded call to a mock method
type MockCall struct {
	Method string
	Args   []interface{}
}

// MockAdminClient is a mock implementation of AdminClientInterface for testing
type MockAdminClient struct {
	mu sync.RWMutex

	// Errors allows injecting errors for specific methods
	Errors map[string]error

	// Calls tracks all method invocations for verification
	Calls []MockCall

	// Data stores for mock responses
	DashboardClientID    string
	Users                map[string][]OrganizationUser   // groupID -> users
	GroupTree            map[string]*GroupNode           // organizationID -> tree
	GroupMembers         map[string][]OrganizationUser   // groupID -> members
	Resources            map[string]*ResourceResponse    // resourceID -> resource
	Invitations          map[string]*InvitationResponse  // invitationID -> invitation
	InvitationLists      map[string][]InvitationResponse // resourceID -> invitations
	OrganizationAliases  map[string]bool                 // alias -> exists
	AvailableRoles       map[string][]string             // organizationID -> roles
	ResourceGroups       map[string]*ResourceGroupListResponse
	ResourceGroupMembers map[string]*ResourceGroupMemberListResponse
	ChangeUserRoleResp   *ChangeUserRoleResponse
}

// NewMockAdminClient creates a new mock admin client for testing
func NewMockAdminClient() *MockAdminClient {
	return &MockAdminClient{
		Errors:               make(map[string]error),
		Calls:                make([]MockCall, 0),
		DashboardClientID:    DefaultDashboardClientID,
		Users:                make(map[string][]OrganizationUser),
		GroupTree:            make(map[string]*GroupNode),
		GroupMembers:         make(map[string][]OrganizationUser),
		Resources:            make(map[string]*ResourceResponse),
		Invitations:          make(map[string]*InvitationResponse),
		InvitationLists:      make(map[string][]InvitationResponse),
		OrganizationAliases:  make(map[string]bool),
		AvailableRoles:       make(map[string][]string),
		ResourceGroups:       make(map[string]*ResourceGroupListResponse),
		ResourceGroupMembers: make(map[string]*ResourceGroupMemberListResponse),
	}
}

// Compile-time check to ensure MockAdminClient implements AdminClientInterface
var _ AdminClientInterface = (*MockAdminClient)(nil)

// SetError configures an error to be returned for a specific method
func (m *MockAdminClient) SetError(method string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Errors[method] = err
}

// ClearErrors removes all configured errors
func (m *MockAdminClient) ClearErrors() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Errors = make(map[string]error)
}

// GetCalls returns all recorded calls
func (m *MockAdminClient) GetCalls() []MockCall {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]MockCall, len(m.Calls))
	copy(result, m.Calls)
	return result
}

// ClearCalls removes all recorded calls
func (m *MockAdminClient) ClearCalls() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Calls = make([]MockCall, 0)
}

// Reset clears all state (errors, calls, and data)
func (m *MockAdminClient) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Errors = make(map[string]error)
	m.Calls = make([]MockCall, 0)
	m.DashboardClientID = DefaultDashboardClientID
	m.Users = make(map[string][]OrganizationUser)
	m.GroupTree = make(map[string]*GroupNode)
	m.GroupMembers = make(map[string][]OrganizationUser)
	m.Resources = make(map[string]*ResourceResponse)
	m.Invitations = make(map[string]*InvitationResponse)
	m.InvitationLists = make(map[string][]InvitationResponse)
	m.OrganizationAliases = make(map[string]bool)
	m.AvailableRoles = make(map[string][]string)
	m.ResourceGroups = make(map[string]*ResourceGroupListResponse)
	m.ResourceGroupMembers = make(map[string]*ResourceGroupMemberListResponse)
	m.ChangeUserRoleResp = nil
}

// recordCall records a method invocation
func (m *MockAdminClient) recordCall(method string, args ...interface{}) {
	m.Calls = append(m.Calls, MockCall{Method: method, Args: args})
}

// checkError returns the configured error for a method, if any
func (m *MockAdminClient) checkError(method string) error {
	if err, ok := m.Errors[method]; ok {
		return err
	}
	return nil
}

// --- AdminClientInterface Implementation ---

// GetDashboardClientID returns the configured dashboard client ID
func (m *MockAdminClient) GetDashboardClientID() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("GetDashboardClientID")
	return m.DashboardClientID
}

// GetGroupUsers returns mock users for a group
func (m *MockAdminClient) GetGroupUsers(ctx context.Context, organizationID string) ([]OrganizationUser, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("GetGroupUsers", organizationID)
	if err := m.checkError("GetGroupUsers"); err != nil {
		return nil, err
	}
	if users, ok := m.Users[organizationID]; ok {
		return users, nil
	}
	return []OrganizationUser{}, nil
}

// GetGroupTree returns mock group tree for an organization
func (m *MockAdminClient) GetGroupTree(ctx context.Context, organizationID string) (*GroupNode, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("GetGroupTree", organizationID)
	if err := m.checkError("GetGroupTree"); err != nil {
		return nil, err
	}
	if tree, ok := m.GroupTree[organizationID]; ok {
		return tree, nil
	}
	return &GroupNode{ID: organizationID, Name: organizationID, Type: "resource"}, nil
}

// GetGroupMembers returns mock members for a group
func (m *MockAdminClient) GetGroupMembers(ctx context.Context, groupID string) ([]OrganizationUser, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("GetGroupMembers", groupID)
	if err := m.checkError("GetGroupMembers"); err != nil {
		return nil, err
	}
	if members, ok := m.GroupMembers[groupID]; ok {
		return members, nil
	}
	return []OrganizationUser{}, nil
}

// CreateResource creates a mock resource
func (m *MockAdminClient) CreateResource(ctx context.Context, request ResourceCreateRequest) (*ResourceResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("CreateResource", request)
	if err := m.checkError("CreateResource"); err != nil {
		return nil, err
	}
	response := &ResourceResponse{
		ID:         request.ID,
		Title:      request.Title,
		Type:       request.Type,
		OwnerID:    request.OwnerID,
		Scopes:     request.Scopes,
		Attributes: request.Attributes,
		GroupID:    "mock-group-" + request.ID,
	}
	m.Resources[request.ID] = response
	return response, nil
}

// UpdateResource updates a mock resource
func (m *MockAdminClient) UpdateResource(ctx context.Context, resourceID string, request ResourceUpdateRequest) (*ResourceResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("UpdateResource", resourceID, request)
	if err := m.checkError("UpdateResource"); err != nil {
		return nil, err
	}
	if existing, ok := m.Resources[resourceID]; ok {
		if request.Title != "" {
			existing.Title = request.Title
		}
		if request.Attributes != nil {
			existing.Attributes = request.Attributes
		}
		return existing, nil
	}
	return nil, fmt.Errorf("resource not found: %s", resourceID)
}

// DeleteResource deletes a mock resource
func (m *MockAdminClient) DeleteResource(ctx context.Context, resourceID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("DeleteResource", resourceID)
	if err := m.checkError("DeleteResource"); err != nil {
		return err
	}
	delete(m.Resources, resourceID)
	return nil
}

// CreateInvitation creates a mock invitation
func (m *MockAdminClient) CreateInvitation(ctx context.Context, resourceID string, request InvitationRequest) (*InvitationResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("CreateInvitation", resourceID, request)
	if err := m.checkError("CreateInvitation"); err != nil {
		return nil, err
	}
	response := &InvitationResponse{
		ID:         "mock-invite-" + request.Email,
		Email:      request.Email,
		FirstName:  request.FirstName,
		LastName:   request.LastName,
		ResourceID: resourceID,
		Status:     "pending",
		InviteLink: "https://mock.keycloak/invite/" + request.Email,
	}
	m.Invitations[response.ID] = response
	m.InvitationLists[resourceID] = append(m.InvitationLists[resourceID], *response)
	return response, nil
}

// ListInvitations returns mock invitations for a resource
func (m *MockAdminClient) ListInvitations(ctx context.Context, resourceID string, first, max int) (*InvitationListResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("ListInvitations", resourceID, first, max)
	if err := m.checkError("ListInvitations"); err != nil {
		return nil, err
	}
	invitations := m.InvitationLists[resourceID]
	return &InvitationListResponse{
		Invitations: invitations,
		Total:       len(invitations),
	}, nil
}

// DeleteInvitation deletes a mock invitation
func (m *MockAdminClient) DeleteInvitation(ctx context.Context, resourceID, invitationID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("DeleteInvitation", resourceID, invitationID)
	if err := m.checkError("DeleteInvitation"); err != nil {
		return err
	}
	delete(m.Invitations, invitationID)
	// Remove from list
	if list, ok := m.InvitationLists[resourceID]; ok {
		filtered := make([]InvitationResponse, 0)
		for _, inv := range list {
			if inv.ID != invitationID {
				filtered = append(filtered, inv)
			}
		}
		m.InvitationLists[resourceID] = filtered
	}
	return nil
}

// DisableOrganization disables a mock organization
func (m *MockAdminClient) DisableOrganization(ctx context.Context, alias string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("DisableOrganization", alias)
	if err := m.checkError("DisableOrganization"); err != nil {
		return err
	}
	// Soft delete - mark as non-existent for alias check purposes
	m.OrganizationAliases[alias] = false
	return nil
}

// EnableOrganization re-enables a mock organization
func (m *MockAdminClient) EnableOrganization(ctx context.Context, alias string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("EnableOrganization", alias)
	if err := m.checkError("EnableOrganization"); err != nil {
		return err
	}
	m.OrganizationAliases[alias] = true
	return nil
}

// CheckOrganizationAliasExists checks if an alias exists
func (m *MockAdminClient) CheckOrganizationAliasExists(ctx context.Context, alias string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("CheckOrganizationAliasExists", alias)
	if err := m.checkError("CheckOrganizationAliasExists"); err != nil {
		return false, err
	}
	exists, ok := m.OrganizationAliases[alias]
	return ok && exists, nil
}

// ChangeUserRole changes a user's role in a mock organization
func (m *MockAdminClient) ChangeUserRole(ctx context.Context, resourceID, userID, newRole string) (*ChangeUserRoleResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("ChangeUserRole", resourceID, userID, newRole)
	if err := m.checkError("ChangeUserRole"); err != nil {
		return nil, err
	}
	if m.ChangeUserRoleResp != nil {
		return m.ChangeUserRoleResp, nil
	}
	return &ChangeUserRoleResponse{
		UserID:     userID,
		ResourceID: resourceID,
		Role:       newRole,
	}, nil
}

// GetAvailableRoles returns available roles for a mock organization
func (m *MockAdminClient) GetAvailableRoles(ctx context.Context, organizationID string) ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("GetAvailableRoles", organizationID)
	if err := m.checkError("GetAvailableRoles"); err != nil {
		return nil, err
	}
	if roles, ok := m.AvailableRoles[organizationID]; ok {
		return roles, nil
	}
	return []string{"admin", "member"}, nil
}

// GetResourceGroups returns mock resource groups
func (m *MockAdminClient) GetResourceGroups(ctx context.Context, organizationID, search string, first, offset int, orderBy, order string) (*ResourceGroupListResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("GetResourceGroups", organizationID, search, first, offset, orderBy, order)
	if err := m.checkError("GetResourceGroups"); err != nil {
		return nil, err
	}
	if resp, ok := m.ResourceGroups[organizationID]; ok {
		return resp, nil
	}
	return &ResourceGroupListResponse{
		TotalCount: 0,
		HasMore:    false,
		Items:      []ResourceGroupRepresentation{},
	}, nil
}

// GetResourceGroupMembers returns mock resource group members
func (m *MockAdminClient) GetResourceGroupMembers(ctx context.Context, organizationID, resourceGroupID string, roleFilter []string, search string, enabled, emailVerified *bool, first, offset int, orderBy, order string) (*ResourceGroupMemberListResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordCall("GetResourceGroupMembers", organizationID, resourceGroupID, roleFilter, search, enabled, emailVerified, first, offset, orderBy, order)
	if err := m.checkError("GetResourceGroupMembers"); err != nil {
		return nil, err
	}
	key := organizationID + "/" + resourceGroupID
	if resp, ok := m.ResourceGroupMembers[key]; ok {
		return resp, nil
	}
	return &ResourceGroupMemberListResponse{
		TotalCount:     0,
		HasMore:        false,
		Items:          []ResourceGroupMemberRepresentation{},
		AvailableRoles: []string{"admin", "member"},
	}, nil
}

// --- Helper Methods for Test Setup ---

// SetUsers configures mock users for a group
func (m *MockAdminClient) SetUsers(groupID string, users []OrganizationUser) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Users[groupID] = users
}

// SetGroupTree configures mock group tree for an organization
func (m *MockAdminClient) SetGroupTree(organizationID string, tree *GroupNode) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.GroupTree[organizationID] = tree
}

// SetGroupMembers configures mock members for a group
func (m *MockAdminClient) SetGroupMembers(groupID string, members []OrganizationUser) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.GroupMembers[groupID] = members
}

// SetResource configures a mock resource
func (m *MockAdminClient) SetResource(resourceID string, resource *ResourceResponse) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Resources[resourceID] = resource
}

// SetOrganizationAlias marks an alias as existing or not
func (m *MockAdminClient) SetOrganizationAlias(alias string, exists bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.OrganizationAliases[alias] = exists
}

// SetAvailableRoles configures available roles for an organization
func (m *MockAdminClient) SetAvailableRoles(organizationID string, roles []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.AvailableRoles[organizationID] = roles
}

// SetResourceGroups configures mock resource groups response
func (m *MockAdminClient) SetResourceGroups(organizationID string, resp *ResourceGroupListResponse) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ResourceGroups[organizationID] = resp
}

// SetResourceGroupMembers configures mock resource group members response
func (m *MockAdminClient) SetResourceGroupMembers(organizationID, resourceGroupID string, resp *ResourceGroupMemberListResponse) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ResourceGroupMembers[organizationID+"/"+resourceGroupID] = resp
}
