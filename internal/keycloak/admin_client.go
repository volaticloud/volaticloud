package keycloak

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"volaticloud/internal/auth"

	"github.com/Nerzal/gocloak/v13"
)

// AdminClient handles Keycloak Admin API operations using gocloak
type AdminClient struct {
	client     *gocloak.GoCloak
	httpClient *http.Client
	config     auth.KeycloakConfig
}

// OrganizationUser represents a user in the organization
type OrganizationUser struct {
	ID            string
	Username      string
	Email         string
	EmailVerified bool
	FirstName     string
	LastName      string
	Enabled       bool
	CreatedAt     int64
}

// GroupNode represents a node in the group hierarchy tree
type GroupNode struct {
	ID       string
	Name     string
	Path     string
	Type     string // "resource" or "role"
	Title    string // Display title from GROUP_TITLE attribute
	Children []*GroupNode
}

// ResourceCreateRequest represents a request to create a unified resource (UMA + group)
type ResourceCreateRequest struct {
	ID         string              `json:"id"`         // Resource ID (UUID)
	Title      string              `json:"title"`      // Display title
	Type       string              `json:"type"`       // Resource type (strategy, bot, exchange, runner)
	OwnerID    string              `json:"ownerId"`    // Parent resource ID (optional)
	Scopes     []string            `json:"scopes"`     // Authorization scopes
	Attributes map[string][]string `json:"attributes"` // Additional attributes (e.g., {"public": ["true"]})
}

// ResourceUpdateRequest represents a request to update a unified resource
type ResourceUpdateRequest struct {
	Title      string              `json:"title,omitempty"`      // Updated title
	Attributes map[string][]string `json:"attributes,omitempty"` // Updated attributes
}

// ResourceResponse represents the response from resource operations
type ResourceResponse struct {
	ID            string              `json:"id"`            // Resource ID
	Title         string              `json:"title"`         // Display title
	Type          string              `json:"type"`          // Resource type
	OwnerID       string              `json:"ownerId"`       // Parent resource ID
	GroupID       string              `json:"groupId"`       // Keycloak group ID
	UMAResourceID string              `json:"umaResourceId"` // UMA resource ID
	Scopes        []string            `json:"scopes"`        // Authorization scopes
	Attributes    map[string][]string `json:"attributes"`    // Resource attributes
}

// DefaultDashboardClientID is the fallback client ID if not configured
const DefaultDashboardClientID = "dashboard"

// NewAdminClient creates a new Keycloak admin API client
func NewAdminClient(config auth.KeycloakConfig) *AdminClient {
	client := gocloak.NewClient(config.URL)
	return &AdminClient{
		client:     client,
		httpClient: &http.Client{},
		config:     config,
	}
}

// GetDashboardClientID returns the configured dashboard client ID or default
func (a *AdminClient) GetDashboardClientID() string {
	if a.config.DashboardClientID != "" {
		return a.config.DashboardClientID
	}
	return DefaultDashboardClientID
}

// GetGroupUsers fetches all users from a Keycloak group including subgroups
// organizationID is the UUID identifying the organization (from JWT groups claim)
func (a *AdminClient) GetGroupUsers(ctx context.Context, organizationID string) ([]OrganizationUser, error) {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Try to get the group directly by ID first (if organizationID is the Keycloak group ID)
	// This will include full group representation with subgroups
	group, err := a.client.GetGroup(ctx, token.AccessToken, a.config.Realm, organizationID)
	if err != nil {
		// If direct lookup fails, try to find by path
		groupPath := "/" + organizationID

		// Get all groups with full representation (including subgroups)
		full := true
		groups, err := a.client.GetGroups(ctx, token.AccessToken, a.config.Realm, gocloak.GetGroupsParams{
			Full: &full, // Ensure we get full representation with subgroups
		})
		if err != nil {
			return nil, fmt.Errorf("failed to list groups: %w", err)
		}

		// Find the group with matching path
		var targetGroup *gocloak.Group
		for _, g := range groups {
			if g.Path != nil && *g.Path == groupPath {
				targetGroup = g
				break
			}
		}

		if targetGroup == nil {
			return nil, fmt.Errorf("group not found with ID or path: %s", organizationID)
		}

		// If we found by path, reload with GetGroup to ensure we have full details including all subgroups
		if targetGroup.ID != nil {
			group, err = a.client.GetGroup(ctx, token.AccessToken, a.config.Realm, *targetGroup.ID)
			if err != nil {
				return nil, fmt.Errorf("failed to reload group with full details: %w", err)
			}
		} else {
			group = targetGroup
		}
	}

	if group.ID == nil {
		return nil, fmt.Errorf("group found but has no ID")
	}

	// Get all members including subgroups
	users, err := a.getGroupMembersRecursive(ctx, token.AccessToken, *group.ID, group)
	if err != nil {
		return nil, fmt.Errorf("failed to get group members: %w", err)
	}

	return users, nil
}

// getGroupMembersRecursive gets all members from a group and its subgroups
func (a *AdminClient) getGroupMembersRecursive(ctx context.Context, token, groupID string, group *gocloak.Group) ([]OrganizationUser, error) {
	var allUsers []OrganizationUser
	seenUsers := make(map[string]bool) // Deduplicate users

	// Get direct members of this group
	members, err := a.client.GetGroupMembers(ctx, token, a.config.Realm, groupID, gocloak.GetGroupsParams{})
	if err != nil {
		return nil, fmt.Errorf("failed to get group members for %s: %w", groupID, err)
	}

	// Add direct members
	for _, user := range members {
		if user.ID != nil && !seenUsers[*user.ID] {
			allUsers = append(allUsers, a.convertUser(user))
			seenUsers[*user.ID] = true
		}
	}

	// Recursively get members from subgroups
	if group.SubGroups != nil {
		for _, subGroup := range *group.SubGroups {
			if subGroup.ID == nil {
				continue
			}

			// Fetch full subgroup details to get its subgroups
			fullSubGroup, err := a.client.GetGroup(ctx, token, a.config.Realm, *subGroup.ID)
			if err != nil {
				return nil, fmt.Errorf("failed to get subgroup %s: %w", *subGroup.ID, err)
			}

			subMembers, err := a.getGroupMembersRecursive(ctx, token, *subGroup.ID, fullSubGroup)
			if err != nil {
				return nil, err
			}

			for _, user := range subMembers {
				if !seenUsers[user.ID] {
					allUsers = append(allUsers, user)
					seenUsers[user.ID] = true
				}
			}
		}
	}

	return allUsers, nil
}

// convertUser converts gocloak.User to OrganizationUser
func (a *AdminClient) convertUser(user *gocloak.User) OrganizationUser {
	orgUser := OrganizationUser{
		Enabled: user.Enabled != nil && *user.Enabled,
	}

	if user.ID != nil {
		orgUser.ID = *user.ID
	}
	if user.Username != nil {
		orgUser.Username = *user.Username
	}
	if user.Email != nil {
		orgUser.Email = *user.Email
	}
	if user.EmailVerified != nil {
		orgUser.EmailVerified = *user.EmailVerified
	}
	if user.FirstName != nil {
		orgUser.FirstName = *user.FirstName
	}
	if user.LastName != nil {
		orgUser.LastName = *user.LastName
	}
	if user.CreatedTimestamp != nil {
		orgUser.CreatedAt = *user.CreatedTimestamp
	}

	return orgUser
}

// GetGroupTree fetches the hierarchical group tree for an organization
// Returns the root organization group with all subgroups
func (a *AdminClient) GetGroupTree(ctx context.Context, organizationID string) (*GroupNode, error) {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Get the root organization group
	// Try by ID first
	group, err := a.client.GetGroup(ctx, token.AccessToken, a.config.Realm, organizationID)
	if err != nil {
		// If ID lookup fails, try to find by path
		groupPath := "/" + organizationID

		allGroups, err := a.client.GetGroups(ctx, token.AccessToken, a.config.Realm, gocloak.GetGroupsParams{})
		if err != nil {
			return nil, fmt.Errorf("failed to list groups: %w", err)
		}

		// Find the group with matching path
		var targetGroup *gocloak.Group
		for _, g := range allGroups {
			if g.Path != nil && *g.Path == groupPath {
				targetGroup = g
				break
			}
		}

		if targetGroup == nil {
			return nil, fmt.Errorf("group not found with ID or path: %s", organizationID)
		}

		// Reload with GetGroup to get group ID
		if targetGroup.ID != nil {
			group, err = a.client.GetGroup(ctx, token.AccessToken, a.config.Realm, *targetGroup.ID)
			if err != nil {
				return nil, fmt.Errorf("failed to reload group: %w", err)
			}
		} else {
			group = targetGroup
		}
	}

	if group.ID == nil {
		return nil, fmt.Errorf("group found but has no ID")
	}

	// Build the tree recursively by fetching children for each group using the /children endpoint
	return a.buildGroupTreeRecursive(ctx, token.AccessToken, group)
}

// getGroupChildren fetches direct children of a group using the Keycloak Admin API /children endpoint
// This method handles pagination automatically to fetch all children
func (a *AdminClient) getGroupChildren(ctx context.Context, token, groupID string) ([]*gocloak.Group, error) {
	// Keycloak's GetGroup doesn't populate SubGroups, so we need to use the /children endpoint
	// GET /admin/realms/{realm}/groups/{id}/children
	// Supports pagination with ?first={offset}&max={limit}

	var allChildren []*gocloak.Group
	const pageSize = 100 // Fetch 100 children per request
	offset := 0

	for {
		// Build URL with pagination parameters
		url := fmt.Sprintf("%s/admin/realms/%s/groups/%s/children?first=%d&max=%d",
			a.config.URL, a.config.Realm, groupID, offset, pageSize)

		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := a.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch group children: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("failed to get group children (status %d): %s", resp.StatusCode, string(body))
		}

		var children []*gocloak.Group
		if err := json.NewDecoder(resp.Body).Decode(&children); err != nil {
			resp.Body.Close()
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}
		resp.Body.Close()

		// Add this page of children to the result
		allChildren = append(allChildren, children...)

		// If we got fewer results than the page size, we've reached the end
		if len(children) < pageSize {
			break
		}

		// Move to the next page
		offset += pageSize
	}

	return allChildren, nil
}

// buildGroupTreeRecursive builds a group tree by recursively fetching children
// This is necessary because Keycloak doesn't populate SubGroups in a single call
func (a *AdminClient) buildGroupTreeRecursive(ctx context.Context, token string, group *gocloak.Group) (*GroupNode, error) {
	if group == nil {
		return nil, nil
	}

	// Create the node
	node := &GroupNode{
		Children: []*GroupNode{},
	}

	if group.ID != nil {
		node.ID = *group.ID
	}
	if group.Name != nil {
		node.Name = *group.Name
	}
	if group.Path != nil {
		node.Path = *group.Path
	}

	// Extract title from GROUP_TITLE attribute
	if group.Attributes != nil {
		if titleAttr, ok := (*group.Attributes)["GROUP_TITLE"]; ok && len(titleAttr) > 0 {
			node.Title = titleAttr[0]
		}
	}
	// If no title attribute, fall back to name
	if node.Title == "" {
		node.Title = node.Name
	}

	// Determine type: "role" if name starts with "role:", otherwise "resource"
	if len(node.Name) > 5 && node.Name[:5] == "role:" {
		node.Type = "role"
	} else {
		node.Type = "resource"
	}

	// Fetch children using the /children endpoint
	if group.ID != nil {
		children, err := a.getGroupChildren(ctx, token, *group.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get children for group %s: %w", *group.ID, err)
		}

		// Recursively process each child
		for _, child := range children {
			childNode, err := a.buildGroupTreeRecursive(ctx, token, child)
			if err != nil {
				return nil, err
			}

			if childNode != nil {
				node.Children = append(node.Children, childNode)
			}
		}
	}

	return node, nil
}

// GetGroupMembers fetches users from a specific group (non-recursive)
// groupID is the Keycloak group ID
func (a *AdminClient) GetGroupMembers(ctx context.Context, groupID string) ([]OrganizationUser, error) {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Get direct members of this group only (non-recursive)
	members, err := a.client.GetGroupMembers(ctx, token.AccessToken, a.config.Realm, groupID, gocloak.GetGroupsParams{})
	if err != nil {
		return nil, fmt.Errorf("failed to get group members: %w", err)
	}

	// Convert to OrganizationUser
	users := make([]OrganizationUser, 0, len(members))
	for _, user := range members {
		users = append(users, a.convertUser(user))
	}

	return users, nil
}

// CreateResource creates a unified resource (UMA resource + Keycloak group) atomically
// Uses the Keycloak extension's unified API endpoint
func (a *AdminClient) CreateResource(ctx context.Context, request ResourceCreateRequest) (*ResourceResponse, error) {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Build URL
	url := fmt.Sprintf("%s/realms/%s/volaticloud/resources", a.config.URL, a.config.Realm)

	// Marshal request body
	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to create resource (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	// Decode response
	var response ResourceResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// UpdateResource updates a unified resource (UMA resource + Keycloak group) atomically
// Uses the Keycloak extension's unified API endpoint
func (a *AdminClient) UpdateResource(ctx context.Context, resourceID string, request ResourceUpdateRequest) (*ResourceResponse, error) {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Build URL
	url := fmt.Sprintf("%s/realms/%s/volaticloud/resources/%s", a.config.URL, a.config.Realm, resourceID)

	// Marshal request body
	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to update resource (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	// Decode response
	var response ResourceResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// DeleteResource deletes a unified resource (UMA resource + Keycloak group) atomically
// Uses the Keycloak extension's unified API endpoint
func (a *AdminClient) DeleteResource(ctx context.Context, resourceID string) error {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Build URL
	url := fmt.Sprintf("%s/realms/%s/volaticloud/resources/%s", a.config.URL, a.config.Realm, resourceID)

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	// Send request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete resource (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// InvitationRequest represents a request to invite a user to an organization
type InvitationRequest struct {
	Email       string `json:"email"`
	FirstName   string `json:"firstName,omitempty"`
	LastName    string `json:"lastName,omitempty"`
	RedirectURL string `json:"redirectUrl,omitempty"` // URL to redirect to after invitation acceptance
	ClientID    string `json:"clientId,omitempty"`    // Keycloak client ID for the invitation flow
}

// InvitationResponse represents the response from invitation operations
type InvitationResponse struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	FirstName  string `json:"firstName"`
	LastName   string `json:"lastName"`
	ResourceID string `json:"resourceId"`
	Status     string `json:"status"`
	CreatedAt  int64  `json:"createdAt"`
	ExpiresAt  int64  `json:"expiresAt"`
	InviteLink string `json:"inviteLink"`
}

// CreateInvitation creates an invitation for a user to join an organization
// Uses the Keycloak extension's invitation API endpoint
func (a *AdminClient) CreateInvitation(ctx context.Context, resourceID string, request InvitationRequest) (*InvitationResponse, error) {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Build URL
	url := fmt.Sprintf("%s/realms/%s/volaticloud/resources/%s/invitations", a.config.URL, a.config.Realm, resourceID)

	// Marshal request body
	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to create invitation (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	// Decode response
	var response InvitationResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// InvitationListResponse represents the response from list invitations endpoint
type InvitationListResponse struct {
	Invitations []InvitationResponse `json:"invitations"`
	Total       int                  `json:"total"`
}

// ListInvitations lists pending invitations for an organization
func (a *AdminClient) ListInvitations(ctx context.Context, resourceID string, first, max int) (*InvitationListResponse, error) {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Build URL with query parameters
	url := fmt.Sprintf("%s/realms/%s/volaticloud/resources/%s/invitations?first=%d&max=%d",
		a.config.URL, a.config.Realm, resourceID, first, max)

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	// Send request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to list invitations (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	// Decode response
	var listResponse InvitationListResponse
	if err := json.NewDecoder(resp.Body).Decode(&listResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &listResponse, nil
}

// DeleteInvitation cancels/deletes a pending invitation
func (a *AdminClient) DeleteInvitation(ctx context.Context, resourceID, invitationID string) error {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Build URL
	url := fmt.Sprintf("%s/realms/%s/volaticloud/resources/%s/invitations/%s",
		a.config.URL, a.config.Realm, resourceID, invitationID)

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	// Send request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status (204 No Content on success)
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete invitation (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}
