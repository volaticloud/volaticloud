package organization

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"volaticloud/internal/authz"
	"volaticloud/internal/keycloak"
)

// MaxTitleLength is the maximum allowed length for organization titles
const MaxTitleLength = 100

// CreateRequest contains the parameters for creating an organization
type CreateRequest struct {
	Title  string
	UserID string // The user who will become admin of the organization
}

// CreateResponse contains the result of organization creation
type CreateResponse struct {
	ID    uuid.UUID
	Title string
}

// Create creates a new organization with the given title and adds the user as admin.
// This function handles validation, Keycloak resource creation, role assignment, and rollback on failure.
// The admin client is retrieved from context via authz.GetAdminClientFromContext.
func Create(ctx context.Context, req CreateRequest) (*CreateResponse, error) {
	// Validate inputs
	if err := validateTitle(req.Title); err != nil {
		return nil, err
	}

	// Get admin client from context
	adminClient := authz.GetAdminClientFromContext(ctx)
	if adminClient == nil {
		return nil, fmt.Errorf("admin client not available")
	}

	// Add timeout to Keycloak operations to prevent hanging
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Generate new UUID for the organization
	orgID := uuid.New()

	// Create organization resource via Keycloak extension API
	// This creates: UMA resource, group hierarchy with role subgroups
	request := keycloak.ResourceCreateRequest{
		ID:     orgID.String(),
		Title:  strings.TrimSpace(req.Title),
		Type:   "organization",
		Scopes: []string{"view", "edit", "delete", "invite-user", "manage-users", "view-secrets"},
	}

	response, err := adminClient.CreateResource(ctx, request)
	if err != nil {
		log.Printf("ERROR: failed to create organization resource: %v", err)
		return nil, fmt.Errorf("failed to create organization: %w", err)
	}

	// Add the user as admin of the organization
	_, err = adminClient.ChangeUserRole(ctx, response.ID, req.UserID, "admin")
	if err != nil {
		log.Printf("ERROR: failed to add user as admin: %v", err)
		// Rollback: delete the created organization to avoid orphaned resources
		if deleteErr := adminClient.DeleteResource(ctx, response.ID); deleteErr != nil {
			log.Printf("ERROR: failed to rollback organization creation: %v", deleteErr)
		} else {
			log.Printf("INFO: rolled back organization creation after user role assignment failure")
		}
		return nil, fmt.Errorf("failed to add you as organization admin: %w", err)
	}

	// Parse the response ID
	responseID, err := uuid.Parse(response.ID)
	if err != nil {
		return nil, fmt.Errorf("invalid organization ID in response: %w", err)
	}

	return &CreateResponse{
		ID:    responseID,
		Title: response.Title,
	}, nil
}

// validateTitle validates the organization title
func validateTitle(title string) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return fmt.Errorf("organization title is required")
	}
	if len(title) > MaxTitleLength {
		return fmt.Errorf("organization title must be %d characters or less", MaxTitleLength)
	}
	// Validate for control characters (security: prevent injection in Keycloak group names)
	for _, r := range title {
		if r < 32 || r == 127 {
			return fmt.Errorf("organization title contains invalid characters")
		}
	}
	return nil
}

// ValidateTitle is exported for use in tests and other packages
func ValidateTitle(title string) error {
	return validateTitle(title)
}
