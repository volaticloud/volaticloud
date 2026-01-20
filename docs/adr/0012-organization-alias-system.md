# 0012. Organization Alias System

Date: 2026-01-19

## Status

Accepted

## Context and Problem Statement

Organizations in VolatiCloud are identified by UUIDs (e.g., `550e8400-e29b-41d4-a716-446655440000`), which are:

- Not human-readable or memorable
- Difficult to communicate verbally or share in URLs
- Not suitable for display in user interfaces

**The Problem:** How do we provide human-readable, URL-friendly identifiers for organizations while maintaining uniqueness and security?

## Decision Drivers

- **Human-readability**: Organizations need identifiable aliases like `acme-corp` or `trading-team-alpha`
- **URL-friendliness**: Aliases must be safe for use in URLs without encoding
- **Uniqueness**: Aliases must be globally unique across all organizations
- **Immutability**: Once set, aliases should not change to prevent broken links and references
- **Auto-generation**: System should auto-generate aliases from titles for convenience
- **Customization**: Users should be able to customize aliases before creation
- **Security**: Aliases should not expose internal identifiers or allow path traversal

## Considered Options

### Option 1: UUID-Only (Current)

Keep using UUIDs as the only identifier.

**Pros:**

- No changes required
- Guaranteed uniqueness

**Cons:**

- Poor user experience
- Not human-readable
- Difficult to share or communicate

### Option 2: Alias as Primary Key

Replace UUID with alias as the primary identifier for organizations.

**Pros:**

- Simple model with single identifier
- Clean URLs

**Cons:**

- Breaking change for existing integrations
- Alias changes would require cascading updates
- Potential conflicts with existing UUIDs

### Option 3: Dual Identifier System (Chosen)

Add alias as an immutable, unique secondary identifier alongside UUID.

**Pros:**

- Backward compatible (UUIDs still work)
- Human-readable aliases for user-facing operations
- Immutability prevents broken references
- Clear separation of internal vs external identifiers

**Cons:**

- Two identifiers to manage
- Must enforce uniqueness on aliases
- Migration needed for existing organizations

## Decision Outcome

Chosen option: **Dual Identifier System**, because it:

1. Maintains backward compatibility with existing UUID-based code
2. Provides human-readable identifiers for user-facing operations
3. Enforces immutability to prevent broken references
4. Supports both auto-generated and custom aliases

### Consequences

**Positive:**

- Human-readable organization identifiers in URLs and UI
- Auto-generated aliases from organization titles
- Immutable aliases prevent broken external references
- Backward compatible - UUIDs still work internally

**Negative:**

- Two identifiers to track (UUID and alias)
- Must validate alias uniqueness at creation time
- Existing organizations need migration to add aliases

**Neutral:**

- Keycloak Native Organization uses alias as its identifier
- UMA resources continue to use alias as resource ID

## Implementation

### Alias Validation Rules

Aliases must conform to these rules:

| Rule | Validation | Example |
|------|------------|---------|
| Length | 3-50 characters | `abc` (min), `my-organization-name-here...` (max 50) |
| Characters | Lowercase alphanumeric + hyphens | `my-org-123` |
| Start/End | Must start and end with alphanumeric | `my-org` (valid), `-my-org` (invalid) |
| Consecutive | No consecutive hyphens | `my-org` (valid), `my--org` (invalid) |
| Reserved | Cannot be `..`, `.`, or contain path traversal | `../admin` (invalid) |

### Alias Generation Algorithm

When alias is not provided, it's auto-generated from title:

```go
func GenerateAliasFromTitle(title string) string {
    // 1. Normalize Unicode and remove diacritics
    //    "Café Résumé" → "Cafe Resume"

    // 2. Convert to lowercase
    //    "Cafe Resume" → "cafe resume"

    // 3. Replace non-alphanumeric with hyphens
    //    "cafe resume" → "cafe-resume"

    // 4. Remove consecutive hyphens
    //    "cafe--resume" → "cafe-resume"

    // 5. Trim hyphens from start/end
    //    "-cafe-resume-" → "cafe-resume"

    // 6. Truncate to 50 characters (at word boundary if possible)

    // 7. If result < 3 chars, generate fallback: "org-{timestamp}"
}
```

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Dashboard  │     │  Go Backend  │     │     Keycloak     │
│              │     │              │     │                  │
│ Title input  │────▶│ Validation   │────▶│ Native Org       │
│ Alias input  │     │ Generation   │     │ (alias as ID)    │
│ (optional)   │     │ Uniqueness   │     │                  │
│              │     │              │     │ UMA Resource     │
│              │     │              │     │ (alias as ID)    │
└──────────────┘     └──────────────┘     └──────────────────┘
```

### Key Files

**Backend (Go):**

- `internal/organization/create.go` - Alias validation and generation
- `internal/organization/create_test.go` - Comprehensive validation tests
- `internal/graph/schema.graphqls` - GraphQL schema with alias fields
- `internal/graph/schema.resolvers.go` - Mutation resolvers

**Frontend (React):**

- `dashboard/src/components/Organization/CreateOrganizationDialog.tsx` - UI with alias preview
- `dashboard/src/components/Organization/CreateOrganizationDialog.test.tsx` - Component tests

**Keycloak (Java):**

- `keycloak/extensions/tenant-system/.../ResourceManagementService.java` - Uses alias as resource ID

### GraphQL Schema

```graphql
input CreateOrganizationInput {
  """Organization title (required, 1-100 characters)"""
  title: String!

  """
  URL-friendly alias (optional, 3-50 chars, lowercase alphanumeric + hyphens).
  Auto-generated from title if not provided. Immutable after creation.
  """
  alias: String
}

type CreateOrganizationResponse {
  """The organization's unique alias (immutable identifier)"""
  alias: String!

  """The organization's display title"""
  title: String!
}
```

### Security Considerations

1. **Path Traversal Prevention**: Aliases cannot contain `..`, `/`, or `\`
2. **Directory Traversal**: Validate alias doesn't start with `.` or contain path separators
3. **Uniqueness Check**: Must verify alias doesn't exist before creation
4. **Keycloak Validation**: Keycloak Native Organization API also validates uniqueness
5. **Rate Limiting**: Consider rate limiting alias generation to prevent enumeration

### Uniqueness Validation

Alias uniqueness is validated at multiple levels:

1. **Go Backend**: Pre-check via Keycloak Admin API before creation
2. **Keycloak Extension**: Native Organization API enforces uniqueness
3. **Database**: (Future) Consider adding unique constraint if storing aliases locally

```go
// internal/organization/create.go
func Create(ctx context.Context, req CreateRequest) (*CreateResponse, error) {
    // ... validation ...

    // Check alias uniqueness via Keycloak
    adminClient := authz.GetAdminClientFromContext(ctx)
    exists, err := adminClient.CheckOrganizationAliasExists(ctx, alias)
    if err != nil {
        return nil, fmt.Errorf("failed to check alias uniqueness: %w", err)
    }
    if exists {
        return nil, fmt.Errorf("organization alias '%s' already exists", alias)
    }

    // ... create organization ...
}
```

## Validation

How to verify this decision is being followed:

1. **Unit tests**: Run `go test ./internal/organization/...` for validation tests
2. **Frontend tests**: Run `npm test` in dashboard for alias generation tests
3. **Manual testing**: Create organization via dashboard, verify alias is auto-generated
4. **Security testing**: Attempt path traversal aliases, verify rejection

## Token Claim Format (Keycloak 26+)

With Keycloak 26+, organizations are exposed via the native `organizations` claim in JWT tokens.
This replaces the custom `organization-title-mapper` extension.

### Token Structure

```json
{
  "organizations": {
    "go-gar": {
      "id": "632bb1f3-e102-486c-952d-7c96cb45dba6",
      "organization_title": ["Go Gar"]
    },
    "acme-corp": {
      "id": "ac99069f-00c5-4b55-beff-26e014a00e3b"
    }
  }
}
```

**Claim Structure:**

| Field | Description |
|-------|-------------|
| Key (e.g., `go-gar`) | Organization alias (immutable identifier) |
| `id` | Organization UUID (optional, may be same as alias) |
| `organization_title` | Array of display titles (optional, falls back to alias) |

### OIDC Scope

To include all user organizations in the token, use the `organization:*` scope:

```typescript
scope: 'openid organization:* profile email'
```

### Dashboard Integration

The `GroupContext` extracts organizations from the token:

1. **Primary**: Parses native `organizations` claim (Keycloak 26+)
2. **Fallback**: Uses legacy `groups` + `organization_titles` claims (backwards compatibility)

```typescript
// dashboard/src/contexts/GroupContext.tsx
function extractOrganizationsFromToken(token: string): Organization[] {
  const decoded = jwtDecode(token);

  // Try native organizations claim first
  if (decoded.organizations) {
    return Object.entries(decoded.organizations).map(([alias, data]) => ({
      id: data.id || alias,
      alias,
      title: data.organization_title?.[0] || alias,
    }));
  }

  // Fallback to legacy groups claim
  return extractOrganizationsFromLegacyGroups(decoded);
}
```

### Migration Notes

- **Removed**: Custom `organization-title-mapper` Keycloak extension
- **Added**: `organization:*` scope in OIDC configuration
- **Preserved**: Backwards compatibility with legacy token format

## References

### Related ADRs

- [ADR-0008: Multi-Tenant Authorization](0008-multi-tenant-authorization.md) - Organization authorization context
- [ADR-0010: Organization Invitation System](0010-organization-invitation-system.md) - Uses organization alias for invitations

### External References

- [URL-safe characters (RFC 3986)](https://datatracker.ietf.org/doc/html/rfc3986)
- [Slug generation best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure)
- [Unicode normalization (NFD/NFC)](https://unicode.org/reports/tr15/)
