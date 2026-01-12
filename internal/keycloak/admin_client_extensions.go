package keycloak

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// RoleInfo represents role information with member count
type RoleInfo struct {
	Name        string `json:"name"`
	MemberCount int    `json:"memberCount"`
}

// ResourceGroupRepresentation represents a normalized resource group
type ResourceGroupRepresentation struct {
	Name         string     `json:"name"`
	Path         string     `json:"path"`
	Title        string     `json:"title"`
	Type         string     `json:"type"` // GROUP_TYPE attribute (strategy, bot, exchange, runner, organization, none)
	Roles        []RoleInfo `json:"roles"`
	TotalMembers int        `json:"totalMembers"`
	HasChildren  bool       `json:"hasChildren"`
}

// ResourceGroupListResponse represents paginated resource group list
type ResourceGroupListResponse struct {
	TotalCount int                           `json:"totalCount"`
	HasMore    bool                          `json:"hasMore"`
	Items      []ResourceGroupRepresentation `json:"items"`
}

// MemberUser represents user information for resource group members
type MemberUser struct {
	ID               string `json:"id"`
	Username         string `json:"username"`
	Email            string `json:"email"`
	EmailVerified    bool   `json:"emailVerified"`
	FirstName        string `json:"firstName"`
	LastName         string `json:"lastName"`
	Enabled          bool   `json:"enabled"`
	CreatedTimestamp int64  `json:"createdTimestamp"`
}

// ResourceGroupMemberRepresentation represents a member with role information
type ResourceGroupMemberRepresentation struct {
	User        MemberUser `json:"user"`
	Roles       []string   `json:"roles"`
	PrimaryRole string     `json:"primaryRole"`
}

// ResourceGroupMemberListResponse represents paginated member list
type ResourceGroupMemberListResponse struct {
	TotalCount int                                 `json:"totalCount"`
	HasMore    bool                                `json:"hasMore"`
	Items      []ResourceGroupMemberRepresentation `json:"items"`
}

// GetResourceGroups calls the Keycloak extension endpoint to fetch resource groups
// with normalization, search, filtering, sorting, and pagination.
//
// Parameters:
//   - organizationID: Parent group ID (e.g., organization UUID)
//   - search: Search by title (case-insensitive)
//   - first: Page size (default: 20, max: 100)
//   - offset: Skip N items (default: 0)
//   - orderBy: Sort field: "title", "totalMembers" (default: "title")
//   - order: Sort direction: "asc", "desc" (default: "asc")
func (a *AdminClient) GetResourceGroups(
	ctx context.Context,
	organizationID string,
	search string,
	first, offset int,
	orderBy, order string,
) (*ResourceGroupListResponse, error) {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Build URL
	endpoint := fmt.Sprintf("%s/realms/%s/volaticloud/organizations/%s/resource-groups",
		a.config.URL, a.config.Realm, url.PathEscape(organizationID))

	// Build query parameters
	params := url.Values{}
	if search != "" {
		params.Set("search", search)
	}
	if first > 0 {
		params.Set("first", strconv.Itoa(first))
	}
	if offset > 0 {
		params.Set("offset", strconv.Itoa(offset))
	}
	if orderBy != "" {
		params.Set("orderBy", orderBy)
	}
	if order != "" {
		params.Set("order", order)
	}

	if len(params) > 0 {
		endpoint += "?" + params.Encode()
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result ResourceGroupListResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// GetResourceGroupMembers calls the Keycloak extension endpoint to fetch resource group members
// with role information, search, filtering, sorting, and pagination.
//
// Parameters:
//   - organizationID: Parent group ID (for context)
//   - resourceGroupID: Resource group ID
//   - roleFilter: Filter by specific roles (nil = all roles)
//   - search: Search username, email, firstName, lastName (case-insensitive)
//   - enabled: Filter by user enabled status (nil = no filter)
//   - emailVerified: Filter by email verified status (nil = no filter)
//   - first: Page size (default: 50, max: 100)
//   - offset: Skip N items (default: 0)
//   - orderBy: Sort field: "username", "email", "firstName", "lastName", "createdAt", "primaryRole"
//   - order: Sort direction: "asc", "desc"
func (a *AdminClient) GetResourceGroupMembers(
	ctx context.Context,
	organizationID, resourceGroupID string,
	roleFilter []string,
	search string,
	enabled, emailVerified *bool,
	first, offset int,
	orderBy, order string,
) (*ResourceGroupMemberListResponse, error) {
	// Get admin token
	token, err := a.client.LoginClient(ctx, a.config.ClientID, a.config.ClientSecret, a.config.Realm)
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin client: %w", err)
	}

	// Build URL
	endpoint := fmt.Sprintf("%s/realms/%s/volaticloud/organizations/%s/resource-groups/%s/members",
		a.config.URL, a.config.Realm, url.PathEscape(organizationID), url.PathEscape(resourceGroupID))

	// Build query parameters
	params := url.Values{}
	if len(roleFilter) > 0 {
		// Use "roles" parameter for multiple roles (comma-separated)
		params.Set("roles", strings.Join(roleFilter, ","))
	}
	if search != "" {
		params.Set("search", search)
	}
	if enabled != nil {
		params.Set("enabled", strconv.FormatBool(*enabled))
	}
	if emailVerified != nil {
		params.Set("emailVerified", strconv.FormatBool(*emailVerified))
	}
	if first > 0 {
		params.Set("first", strconv.Itoa(first))
	}
	if offset > 0 {
		params.Set("offset", strconv.Itoa(offset))
	}
	if orderBy != "" {
		params.Set("orderBy", orderBy)
	}
	if order != "" {
		params.Set("order", order)
	}

	if len(params) > 0 {
		endpoint += "?" + params.Encode()
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result ResourceGroupMemberListResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}
