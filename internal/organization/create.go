package organization

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	"volaticloud/internal/authz"
	"volaticloud/internal/keycloak"
)

// ResourceTypeOrganization is the type identifier for organization resources
const ResourceTypeOrganization = "organization"

// MaxTitleLength is the maximum allowed length for organization titles
const MaxTitleLength = 100

// MinAliasLength is the minimum allowed length for organization aliases
const MinAliasLength = 3

// MaxAliasLength is the maximum allowed length for organization aliases
const MaxAliasLength = 50

// DefaultKeycloakTimeout is the timeout for Keycloak API operations
const DefaultKeycloakTimeout = 30 * time.Second

// aliasRegex validates alias format: lowercase letters, numbers, and hyphens
var aliasRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$`)

// CreateRequest contains the parameters for creating an organization
type CreateRequest struct {
	Title  string
	Alias  string // Optional: if empty, generated from Title. Immutable after creation.
	UserID string // The user who will become admin of the organization
}

// CreateResponse contains the result of organization creation
type CreateResponse struct {
	Alias string // The unique alias (immutable identifier)
	Title string
}

// Create creates a new organization with the given title and adds the user as admin.
// This function handles validation, Keycloak resource creation, role assignment, and rollback on failure.
// The admin client is retrieved from context via authz.GetAdminClientFromContext.
//
// The organization alias is used as the unique identifier. If not provided, it's generated from the title.
// The alias is immutable after creation.
func Create(ctx context.Context, req CreateRequest) (*CreateResponse, error) {
	// Add timeout to prevent hanging on Keycloak operations
	ctx, cancel := context.WithTimeout(ctx, DefaultKeycloakTimeout)
	defer cancel()

	// Validate title
	if err := validateTitle(req.Title); err != nil {
		return nil, err
	}

	// Generate or validate alias
	alias := req.Alias
	if alias == "" {
		alias = GenerateAliasFromTitle(req.Title)
	}
	if err := ValidateAlias(alias); err != nil {
		return nil, err
	}

	// Get admin client from context
	adminClient := authz.GetAdminClientFromContext(ctx)
	if adminClient == nil {
		return nil, fmt.Errorf("admin client not available")
	}

	// Check if alias already exists (provide user-friendly error message)
	exists, err := adminClient.CheckOrganizationAliasExists(ctx, alias)
	if err != nil {
		log.Printf("WARNING: failed to check alias existence: %v", err)
		// Continue anyway - Keycloak will reject duplicates
	} else if exists {
		return nil, fmt.Errorf("organization alias '%s' already exists", alias)
	}

	// Create organization resource via Keycloak extension API
	// The alias is used as the unique identifier for the organization
	// Creation order: Native Organization → Keycloak Group → UMA Resource
	request := keycloak.ResourceCreateRequest{
		ID:     alias, // Use alias as the resource ID
		Title:  strings.TrimSpace(req.Title),
		Type:   ResourceTypeOrganization,
		Scopes: []string{"view", "edit", "delete", "invite-user", "manage-users", "view-secrets", "change-user-roles", "view-users", "mark-alert-as-read"},
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

	return &CreateResponse{
		Alias: response.ID, // The alias is now the ID
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

// ValidateAlias validates an organization alias.
// Alias must be:
// - 3-50 characters long
// - Lowercase alphanumeric with hyphens
// - Cannot start or end with hyphen
// - Cannot have consecutive hyphens
// - Cannot contain path traversal sequences
func ValidateAlias(alias string) error {
	if len(alias) < MinAliasLength {
		return fmt.Errorf("organization alias must be at least %d characters", MinAliasLength)
	}
	if len(alias) > MaxAliasLength {
		return fmt.Errorf("organization alias must be %d characters or less", MaxAliasLength)
	}
	// Security: prevent directory traversal attacks
	if alias == "." || alias == ".." || strings.Contains(alias, "/") || strings.Contains(alias, "\\") {
		return fmt.Errorf("organization alias contains invalid path characters")
	}
	if strings.HasPrefix(alias, ".") {
		return fmt.Errorf("organization alias cannot start with a dot")
	}
	if !aliasRegex.MatchString(alias) {
		return fmt.Errorf("organization alias must be lowercase alphanumeric with hyphens, cannot start or end with hyphen")
	}
	if strings.Contains(alias, "--") {
		return fmt.Errorf("organization alias cannot contain consecutive hyphens")
	}
	return nil
}

// GenerateAliasFromTitle generates a URL-friendly alias from a title.
// - Converts to lowercase
// - Removes diacritics (accents)
// - Replaces spaces and special characters with hyphens
// - Removes consecutive hyphens
// - Trims hyphens from start and end
// - Truncates to MaxAliasLength
func GenerateAliasFromTitle(title string) string {
	// Normalize Unicode and remove diacritics
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	normalized, _, _ := transform.String(t, title)

	// Convert to lowercase
	alias := strings.ToLower(normalized)

	// Replace non-alphanumeric characters with hyphens
	var result strings.Builder
	prevHyphen := false
	for _, r := range alias {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			result.WriteRune(r)
			prevHyphen = false
		} else if !prevHyphen {
			result.WriteRune('-')
			prevHyphen = true
		}
	}

	// Trim hyphens from start and end
	alias = strings.Trim(result.String(), "-")

	// Truncate to max length
	if len(alias) > MaxAliasLength {
		alias = alias[:MaxAliasLength]
		// Remove trailing hyphen after truncation
		alias = strings.TrimRight(alias, "-")
	}

	// If alias is too short or empty, generate a fallback
	if len(alias) < MinAliasLength {
		alias = fmt.Sprintf("org-%d", time.Now().UnixNano()%100000)
	}

	return alias
}
