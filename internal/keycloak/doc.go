/*
Package keycloak provides Keycloak User-Managed Access (UMA) 2.0 integration for resource-based authorization.

# Overview

The keycloak package implements fine-grained authorization using Keycloak's UMA protocol,
enabling per-resource permission management for bots, strategies, exchanges, and backtests.

# Architecture

	┌──────────────────────────────────────────────────────┐
	│              GraphQL @authorized Directive            │
	└────────────────────┬─────────────────────────────────┘
	                     │
	              ┌──────▼──────┐
	              │ UMA Client  │
	              └──────┬──────┘
	                     │
	     ┌───────────────┼───────────────┐
	     │               │               │
	┌────▼────┐    ┌────▼────┐    ┌────▼────┐
	│Register │    │ Request │    │  Check  │
	│Resource │    │Permission│    │  Token  │
	└────┬────┘    └────┬────┘    └────┬────┘
	     │               │               │
	     └───────────────┼───────────────┘
	                     │
	              ┌──────▼──────┐
	              │  Keycloak   │
	              │     UMA     │
	              └─────────────┘

# Core Components

## UMAClientInterface

Interface for UMA operations:

	type UMAClientInterface interface {
		RegisterResource(ctx context.Context, req RegisterResourceRequest) (*RegisterResourceResponse, error)
		UpdateResource(ctx context.Context, resourceID string, req UpdateResourceRequest) error
		DeleteResource(ctx context.Context, resourceID string) error
		RequestPermission(ctx context.Context, req PermissionRequest) (*PermissionResponse, error)
		CheckToken(ctx context.Context, token string) (*TokenIntrospection, error)
	}

## Key Operations

	Register Resource:
	  - Called when entity is created (Bot, Strategy, etc.)
	  - Stores resource_id in database
	  - Sets owner permissions automatically

	Update Resource:
	  - Called when entity is updated
	  - Syncs resource metadata

	Delete Resource:
	  - Called when entity is deleted
	  - Cleanup UMA resource

	Request Permission:
	  - Called by @authorized directive
	  - Returns permission token if granted

	Check Token:
	  - Validates permission tokens
	  - Returns token claims and permissions

# Resource Types

Supported resource types:

	bot:
	  - Permissions: bot:view, bot:update, bot:delete, bot:start, bot:stop

	strategy:
	  - Permissions: strategy:view, strategy:update, strategy:delete

	exchange:
	  - Permissions: exchange:view, exchange:update, exchange:delete

	backtest:
	  - Permissions: backtest:view, backtest:update, backtest:delete

	runner:
	  - Permissions: runner:view, runner:view-secrets, runner:edit, runner:delete

# Authorization Flow

## 1. Entity Creation (Auto-Register):

	User creates bot → GraphQL mutation
	                      ↓
	       ENT hook calls RegisterResource
	                      ↓
	         Keycloak creates UMA resource
	                      ↓
	         Returns resource_id → Store in DB
	                      ↓
	       Owner gets full permissions automatically

## 2. Permission Check (Query/Mutation):

	User queries bot → @authorized directive
	                      ↓
	       Extract resource_id from args
	                      ↓
	      RequestPermission(resource_id, "bot:view")
	                      ↓
	     Keycloak checks policies and permissions
	                      ↓
	    If granted: return token, proceed to resolver
	    If denied: return 403 Forbidden error

## 3. Token Validation:

	Permission token received → CheckToken
	                      ↓
	         Validate with Keycloak
	                      ↓
	    Return claims (sub, permissions, exp)

# GraphQL Integration

## Directive Usage:

	type Mutation {
	  deleteBot(id: ID!): ID! @authorized(resource: "bot", permission: "bot:delete")
	}

Flow:
 1. User makes deleteBot mutation
 2. @authorized directive intercepts
 3. Extract bot ID from args
 4. Call RequestPermission(botID, "bot:delete")
 5. If granted: call resolver
 6. If denied: return error

## Context Injection:

UMAClient injected via middleware:

	func SetUMAClientInContext(ctx context.Context, client UMAClientInterface) context.Context
	func MustGetUMAClientFromContext(ctx context.Context) UMAClientInterface

GraphQL resolvers access via context.

# Entity Lifecycle Hooks

Automatic resource registration via ENT hooks:

## Registration (Create):

	bot.Hooks().OnCreate(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			umaClient := graph.MustGetUMAClientFromContext(ctx)

			resp, err := umaClient.RegisterResource(ctx, keycloak.RegisterResourceRequest{
				Name: botName,
				Type: "bot",
				OwnerID: userID,
				Scopes: []string{"bot:view", "bot:update", "bot:delete"},
			})

			// Store resource_id in bot entity
			m.SetField("resource_id", resp.ID)

			return next.Mutate(ctx, m)
		})
	})

## Update:

	bot.Hooks().OnUpdate(func(next ent.Mutator) ent.Mutator {
		// Call UpdateResource with new metadata
	})

## Delete:

	bot.Hooks().OnDelete(func(next ent.Mutator) ent.Mutator {
		// Call DeleteResource to cleanup
	})

# Configuration

UMAClient creation:

	client, err := keycloak.NewUMAClient(keycloak.Config{
		ServerURL:    "https://keycloak.example.com",
		Realm:        "volaticloud",
		ClientID:     "volaticloud-backend",
		ClientSecret: "secret",
	})

Environment variables:

	KEYCLOAK_URL:           Keycloak server URL
	KEYCLOAK_REALM:         Realm name
	KEYCLOAK_CLIENT_ID:     Client ID
	KEYCLOAK_CLIENT_SECRET: Client secret

# Permission Policies

Keycloak supports various policy types:

	User-Based:
	  - Grant permission to specific users

	Role-Based:
	  - Grant permission to users with roles

	Group-Based:
	  - Grant permission to group members

	JavaScript:
	  - Custom logic for complex rules

	Time-Based:
	  - Grant permission during specific hours

	Aggregated:
	  - Combine multiple policies

# Error Handling

Common errors:

	401 Unauthorized:
	  - No authentication token
	  - Invalid token

	403 Forbidden:
	  - Valid token but no permission
	  - Resource not found

	500 Internal Server Error:
	  - Keycloak unavailable
	  - Network errors

Error propagation:

	if err := umaClient.RequestPermission(ctx, req); err != nil {
		return nil, fmt.Errorf("permission denied: %w", err)
	}

# Testing

## Mock Implementation:

	type MockUMAClient struct {
		RegisterResourceFunc func(ctx context.Context, req RegisterResourceRequest) (*RegisterResourceResponse, error)
		RequestPermissionFunc func(ctx context.Context, req PermissionRequest) (*PermissionResponse, error)
		// ... other methods
	}

Usage in tests:

	mockUMA := &MockUMAClient{
		RegisterResourceFunc: func(ctx context.Context, req RegisterResourceRequest) (*RegisterResourceResponse, error) {
			return &RegisterResourceResponse{ID: "mock-resource-id"}, nil
		},
	}

	resolver := graph.NewResolver(entClient, authClient, mockUMA)

# Files

	uma_client.go      - UMA client implementation
	admin_client.go    - Admin API client (including invitations)
	types.go           - Request/response types
	mock.go            - Mock implementation for testing

# User Invitations

The AdminClient supports inviting users to organizations via Keycloak's
native invitation system (Keycloak 26+). Invited users are automatically
assigned the 'viewer' role upon acceptance.

## Invitation Flow

	1. Admin calls CreateInvitation(ctx, orgID, request)
	2. Keycloak creates invitation and sends email
	3. User clicks invitation link
	4. User registers/logs in via Keycloak
	5. TenantSystemEventListener assigns viewer role
	6. User redirected to dashboard with orgId preserved

## Usage Example

	request := keycloak.InvitationRequest{
	    Email:       "user@example.com",
	    FirstName:   "John",
	    LastName:    "Doe",
	    RedirectURL: "https://app.example.com/?orgId=abc-123",
	    ClientID:    "dashboard",
	}
	response, err := adminClient.CreateInvitation(ctx, orgID, request)
	if err != nil {
	    return fmt.Errorf("failed to create invitation: %w", err)
	}
	fmt.Printf("Invitation created: %s (expires: %d)\n", response.ID, response.ExpiresAt)

## InvitationRequest Fields

	Email:       Required. Email address of the invitee.
	FirstName:   Optional. Used in invitation email.
	LastName:    Optional. Used in invitation email.
	RedirectURL: Optional. URL to redirect after acceptance.
	ClientID:    Optional. Keycloak client for redirect validation.

## InvitationResponse Fields

	ID:         Invitation UUID
	Email:      Invitee email address
	FirstName:  Invitee first name
	LastName:   Invitee last name
	ResourceID: Organization resource ID
	Status:     PENDING or EXPIRED
	CreatedAt:  Creation timestamp (Unix ms)
	ExpiresAt:  Expiration timestamp (Unix ms)
	InviteLink: Full invitation URL

## Security

- Email validation (server-side regex)
- Redirect URL validation against client's allowed URIs
- Token expiration using Keycloak's action token lifespan
- Authorization via 'invite-user' scope

## Related ADR

See docs/adr/0010-organization-invitation-system.md for architectural decisions.

# Related Packages

	internal/graph       - GraphQL directives use UMA client
	internal/auth        - Authentication (JWT tokens)
	internal/ent         - Entity hooks register resources

# References

  - UMA 2.0 Specification: https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html
  - Keycloak Authorization Services: https://www.keycloak.org/docs/latest/authorization_services/
  - GraphQL Directives: internal/graph/directives.go
  - ENT Hooks: internal/ent/schema/*.go
*/
package keycloak
