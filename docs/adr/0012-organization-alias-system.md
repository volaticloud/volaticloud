# 0012. Organization ID System

Date: 2026-01-19

## Status

Accepted

## Context and Problem Statement

Organizations need human-readable, URL-friendly identifiers that are:

- Easy to communicate verbally or share in URLs
- Suitable for display in user interfaces
- Globally unique across all organizations
- Immutable to prevent broken links and references

**The Problem:** How do we provide human-readable identifiers for organizations while maintaining uniqueness and security?

## Decision Drivers

- **Human-readability**: Organizations need identifiable IDs like `acme-corp` or `trading-team-alpha`
- **URL-friendliness**: IDs must be safe for use in URLs without encoding
- **Uniqueness**: IDs must be globally unique across all organizations
- **Immutability**: Once set, IDs should not change to prevent broken links and references
- **Auto-generation**: System should auto-generate IDs from titles for convenience
- **Customization**: Users should be able to customize IDs before creation
- **Security**: IDs should not expose internal information or allow path traversal

## Decision Outcome

Organization IDs are human-readable strings (e.g., `acme-corp`, `my-trading-team`).

**Key principles:**

1. **ID is a string, not a UUID** - The organization ID is the human-readable identifier
2. **Keycloak uses "alias" terminology** - Keycloak Native Organizations call this the "alias", but in our dashboard and backend we call it "ID"
3. **No dual identifiers** - There's one identifier: the ID
4. **No fallbacks or backward compatibility** - Clean implementation without legacy support

### Consequences

**Positive:**

- Human-readable organization identifiers in URLs and UI
- Auto-generated IDs from organization titles
- Immutable IDs prevent broken external references
- Simple mental model: one identifier per organization

**Negative:**

- Must validate ID uniqueness at creation time
- IDs must conform to URL-safe format rules

**Neutral:**

- Keycloak Native Organization uses "alias" terminology internally
- UMA resources use the ID as resource identifier

## Implementation

### ID Validation Rules

Organization IDs must conform to these rules:

| Rule | Validation | Example |
|------|------------|---------|
| Length | 3-50 characters | `abc` (min), `my-organization-name-here...` (max 50) |
| Characters | Lowercase alphanumeric + hyphens | `my-org-123` |
| Start/End | Must start and end with alphanumeric | `my-org` (valid), `-my-org` (invalid) |
| Consecutive | No consecutive hyphens | `my-org` (valid), `my--org` (invalid) |
| Reserved | Cannot be `..`, `.`, or contain path traversal | `../admin` (invalid) |

### ID Generation Algorithm

When ID is not provided, it's auto-generated from title:

```go
func GenerateIdFromTitle(title string) string {
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
│ ID input     │     │ Generation   │     │ (uses "alias")   │
│ (optional)   │     │ Uniqueness   │     │                  │
│              │     │              │     │ UMA Resource     │
│              │     │              │     │ (ID as name)     │
└──────────────┘     └──────────────┘     └──────────────────┘
```

**Note:** Keycloak uses "alias" terminology internally. In our dashboard and backend, we call it "ID".

### Key Files

**Backend (Go):**

- `internal/organization/create.go` - ID validation and generation
- `internal/organization/create_test.go` - Comprehensive validation tests
- `internal/graph/schema.graphqls` - GraphQL schema
- `internal/graph/schema.resolvers.go` - Mutation resolvers

**Frontend (React):**

- `dashboard/src/components/Organization/CreateOrganizationDialog.tsx` - UI with ID preview
- `dashboard/src/components/Organization/CreateOrganizationDialog.test.tsx` - Component tests
- `dashboard/src/contexts/OrganizationContext.tsx` - Organization context (ID from token)

**Keycloak (Java):**

- `keycloak/extensions/tenant-system/.../ResourceManagementService.java` - Uses ID as resource identifier

### GraphQL Schema

```graphql
input CreateOrganizationInput {
  """Organization title (required, 1-100 characters)"""
  title: String!

  """
  URL-friendly ID (optional, 3-50 chars, lowercase alphanumeric + hyphens).
  Auto-generated from title if not provided. Immutable after creation.
  Note: GraphQL field is named 'alias' for Keycloak compatibility.
  """
  alias: String
}

type CreateOrganizationResponse {
  """The organization's unique ID (immutable identifier)"""
  id: String!

  """The organization's display title"""
  title: String!
}
```

### Security Considerations

1. **Path Traversal Prevention**: IDs cannot contain `..`, `/`, or `\`
2. **Directory Traversal**: Validate ID doesn't start with `.` or contain path separators
3. **Uniqueness Check**: Must verify ID doesn't exist before creation
4. **Keycloak Validation**: Keycloak Native Organization API also validates uniqueness
5. **Rate Limiting**: Consider rate limiting ID generation to prevent enumeration

### Uniqueness Validation

ID uniqueness is validated at multiple levels:

1. **Go Backend**: Pre-check via Keycloak Admin API before creation
2. **Keycloak Extension**: Native Organization API enforces uniqueness

```go
// internal/organization/create.go
func Create(ctx context.Context, req CreateRequest) (*CreateResponse, error) {
    // ... validation ...

    // Check ID uniqueness via Keycloak
    adminClient := authz.GetAdminClientFromContext(ctx)
    exists, err := adminClient.CheckOrganizationIdExists(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("failed to check ID uniqueness: %w", err)
    }
    if exists {
        return nil, fmt.Errorf("organization ID '%s' already exists", id)
    }

    // ... create organization ...
}
```

## Validation

How to verify this decision is being followed:

1. **Unit tests**: Run `go test ./internal/organization/...` for validation tests
2. **Frontend tests**: Run `npm test` in dashboard for ID generation tests
3. **Manual testing**: Create organization via dashboard, verify ID is auto-generated
4. **Security testing**: Attempt path traversal IDs, verify rejection

## Token Claim Format (Keycloak 26+)

With Keycloak 26+, organizations are exposed via the native `organization` claim in JWT tokens.

### Token Structure

```json
{
  "organization": {
    "go-gar": {
      "organization_title": ["Go Gar"]
    },
    "acme-corp": {
      "organization_title": ["Acme Corporation"]
    }
  }
}
```

**Claim Structure:**

| Field | Description |
|-------|-------------|
| Key (e.g., `go-gar`) | Organization ID (immutable, human-readable string) |
| `organization_title` | Array of display titles (optional, falls back to ID) |

**Note:** The claim key IS the organization ID. Keycloak calls it "alias" internally, but for us it's the ID.

### OIDC Scope

To include all user organizations in the token, use the `organization:*` scope:

```typescript
scope: 'openid organization:* profile email'
```

### Dashboard Integration

The `GroupContext` extracts organizations from the token:

```typescript
// dashboard/src/contexts/GroupContext.tsx
function extractOrganizationsFromToken(token: string): Organization[] {
  const decoded = jwtDecode(token);
  const organizationClaim = decoded.organization;

  if (!organizationClaim || Object.keys(organizationClaim).length === 0) {
    return [];
  }

  // Key is the organization ID, inner object contains optional title
  return Object.entries(organizationClaim).map(([id, data]) => ({
    id,
    title: data.organization_title?.[0] || id,
  }));
}
```

## References

### Related ADRs

- [ADR-0008: Multi-Tenant Authorization](0008-multi-tenant-authorization.md) - Organization authorization context
- [ADR-0010: Organization Invitation System](0010-organization-invitation-system.md) - Uses organization alias for invitations

### External References

- [URL-safe characters (RFC 3986)](https://datatracker.ietf.org/doc/html/rfc3986)
- [Slug generation best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure)
- [Unicode normalization (NFD/NFC)](https://unicode.org/reports/tr15/)
