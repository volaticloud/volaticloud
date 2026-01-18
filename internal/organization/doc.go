/*
Package organization provides organization management functionality.

# Responsibilities

  - Organization creation and validation
  - Title validation and sanitization
  - Keycloak resource lifecycle management
  - Integration with UMA 2.0 authorization

# Architecture

	┌──────────────────┐
	│ GraphQL Resolver │
	└────────┬─────────┘
	         │
	         ▼
	┌─────────────────────┐
	│ organization.Create │
	└────────┬────────────┘
	         │
	         ├──▶ validateTitle
	         ├──▶ AdminClient.CreateResource (Keycloak)
	         └──▶ AdminClient.ChangeUserRole (Keycloak)

# Rollback Strategy

If role assignment fails after resource creation, the package automatically
rolls back by deleting the created organization resource to prevent orphaned
resources in Keycloak.

# Usage

	import "volaticloud/internal/organization"

	response, err := organization.Create(ctx, organization.CreateRequest{
	    Title:  "My Organization",
	    UserID: userCtx.UserID,
	})

# Validation Rules

  - Title is required (non-empty after trimming)
  - Title maximum length: 100 characters
  - Control characters (ASCII < 32 or DEL) are rejected for security

# Related ADRs

  - ADR-0008: Multi-Tenant Authorization with UMA 2.0
*/
package organization
