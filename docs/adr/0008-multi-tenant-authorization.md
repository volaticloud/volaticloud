# 0008. Multi-Tenant Authorization with UMA 2.0 and Hierarchical Groups

Date: 2025-11-26

## Status

Accepted

## Context and Problem Statement

VolatiCloud is a multi-tenant SaaS platform where users create and manage trading strategies, bots, exchanges, and backtests. The platform requires:

- **Fine-grained authorization**: Per-resource permission checks (not just role-based access)
- **Multi-tenancy**: Automatic organization provisioning per user with data isolation
- **Hierarchical permissions**: Users in parent groups inherit access to child resources
- **Delegated access**: Users can share resources with others (admin/viewer roles)
- **Scalability**: Authorization that scales with thousands of users and resources

**The Problem:** How do we implement resource-level authorization with multi-tenant isolation, hierarchical permission inheritance, and delegated access without reinventing the authorization wheel?

## Decision Drivers

- **Resource-level authorization**: Check permissions per strategy/bot/exchange, not just user roles
- **Automatic tenant provisioning**: Create organization structure on user registration
- **Hierarchical inheritance**: Parent group members have access to child resources
- **Delegated access**: Users can grant admin/viewer permissions to others
- **Standards-based**: Use established protocols (OAuth 2.0, UMA 2.0)
- **Extensible**: Support future permission types without code changes
- **Performance**: Fast permission checks (<100ms)

## Considered Options

### Option 1: Custom RBAC (Role-Based Access Control)

Implement role-based permissions with database tables for roles and permissions.

**Pros:**

- Full control over authorization logic
- No external dependencies

**Cons:**

- **No resource-level permissions** - only role-based (admin, user)
- **No hierarchical inheritance** - must manually duplicate permissions
- **Reinventing the wheel** - authorization is a solved problem
- **Maintenance burden** - must implement permission evaluation logic
- **No delegation** - users can't share resources without admin involvement

### Option 2: Basic Keycloak Roles

Use Keycloak roles and groups for authorization without UMA.

**Pros:**

- Integrated with Keycloak authentication
- Standard OIDC/OAuth2

**Cons:**

- **No resource-level permissions** - roles are global, not per-resource
- **No automatic group provisioning** - must manually create groups
- **No permission delegation** - users can't share resources
- **Coarse-grained** - can't check "user has edit permission on strategy-123"

### Option 3: UMA 2.0 with Hierarchical Groups (Chosen)

Use Keycloak UMA 2.0 for resource protection combined with automatic group hierarchy creation.

**Pros:**

- **Resource-level permissions** - fine-grained per strategy/bot/exchange
- **Hierarchical inheritance** - organization admins have access to all child resources
- **Automatic provisioning** - organizations created on user registration
- **Delegation support** - users can add others to resource groups
- **Standards-based** - UMA 2.0 is OAuth 2.0 extension
- **Policy flexibility** - group-based, role-based, time-based policies
- **Extensible** - add new resource types without backend changes

**Cons:**

- Requires Keycloak extensions (Java)
- Group structure mirrors resource hierarchy (tight coupling)
- Deletion requires cleanup of both UMA resources and groups

## Decision Outcome

Chosen option: **UMA 2.0 with Hierarchical Groups**, because it provides:

1. **Resource-level authorization** via UMA 2.0 protection API
2. **Automatic multi-tenancy** via event-driven group creation
3. **Hierarchical permissions** via parent-child group relationships
4. **Delegated access** via role subgroups (admin/viewer)
5. **Standards compliance** with OAuth 2.0 UMA 2.0 spec

### Consequences

**Positive:**

- Automatic organization provisioning on user registration
- Fine-grained per-resource authorization with < 100ms latency
- Hierarchical permission inheritance (organization admin → all sub-resources)
- Users can delegate access by adding others to resource role groups
- Extensible via Keycloak policies (no code changes for new permission types)
- Standards-based architecture (UMA 2.0 compatible with other OAuth2 systems)

**Negative:**

- Keycloak extensions must be deployed with Keycloak container
- Group structure tightly coupled to resource hierarchy
- Deletion requires cleanup of both UMA resources and groups
- Java codebase separate from Go backend

**Neutral:**

- Resource name === Group name pattern (simple but inflexible)
- Authorization state split between Keycloak (policies) and database (ownerID)

## Implementation

### A. Multi-Tenancy Model

**Organization as Top-Level Tenant:**

- Every user gets an organization on registration (user ID = organization name)
- Organization is a UMA resource with type `urn:volaticloud:resources:tenant`
- No `ownerId` attribute (root-level resource)

**Hierarchical Group Structure:**

```
{userId}/                          # Organization group
├── role:admin                     # Organization admins (user auto-added here)
├── role:viewer                    # Organization viewers
├── {strategyId}/                  # Strategy resource group
│   ├── role:admin                 # Strategy admins (inherit from org)
│   └── role:viewer                # Strategy viewers
├── {botId}/                       # Bot resource group
│   ├── role:admin                 # Bot admins
│   └── role:viewer                # Bot viewers
└── {exchangeId}/                  # Exchange resource group
    ├── role:admin                 # Exchange admins
    └── role:viewer                # Exchange viewers
```

**Key Pattern:**

- **Resource name === Group name** - Each UMA resource has matching Keycloak group
- Each group has two role subgroups: `role:admin` and `role:viewer`
- Users join role subgroups to get permissions on resources

**IMPORTANT - Ownership vs Usage:**

The hierarchical structure above represents **OWNERSHIP for authorization**, not business logic relationships.

**Ownership Hierarchy (Authorization):**

```
Organization
├── Bot           (owned by organization)
├── Strategy      (owned by organization)
├── Exchange      (owned by organization)
└── BotRunner     (owned by organization)
```

**Usage Relationships (Business Logic):**

```
Bot USES Strategy    (via strategy_id foreign key - which Python code to execute)
Bot USES Exchange    (via exchange_id foreign key - which API credentials to use)
Bot USES BotRunner   (via runner_id foreign key - where to run the container)
```

**Code Evidence:**

- `internal/ent/schema/bot.go:67` - `owner_id` field: "Group ID (organization) that owns this bot"
- `internal/ent/schema/strategy.go:53` - `owner_id` field: "Group ID (organization) that owns this strategy"
- `internal/authz/resource.go:152` - Bot registered with `ownerID` = organization ID
- `internal/authz/resource.go:41` - Strategy registered with `ownerID` = organization ID

Both Bot and Strategy are created with the **same `ownerID`** (the organization), making them **siblings** in the authorization hierarchy, not parent-child.

### B. Keycloak Extensions

#### 1. TenantSystemEventListener

**File:** `keycloak/extensions/tenant-system/src/main/java/com/volaticloud/keycloak/TenantSystemEventListener.java`

**Purpose:** Automatic group structure creation on user and resource events

**Event Handlers:**

**User Registration/Creation:**

```java
// Listens to: USER_REGISTER (self-signup) or USER CREATE (admin-created)
private void handleUserRegistration(Event event) {
    String userId = event.getUserId();

    // 1. Create UMA resource (type=organization, name=userId)
    Resource resource = createOrganizationResource(realm, userId);

    // 2. Create group structure with role subgroups
    createHierarchicalGroupStructure(realm, userId, null, GROUP_TYPE_ORGANIZATION);

    // 3. Add user to role:admin subgroup of their organization
    GroupModel adminRole = session.groups().getGroupByName(realm, userGroup, "role:admin");
    user.joinGroup(adminRole);
}
```

**Resource Creation:**

```java
// Listens to: AUTHORIZATION_RESOURCE CREATE
private void handleResourceCreation(AdminEvent event) {
    String resourceName = extractFieldValue(representation, "name");
    String ownerId = extractOwnerIdFromAttributes(representation);
    String resourceType = extractTypeFromAttributes(representation);

    // Create hierarchical group under owner's organization
    createHierarchicalGroupStructure(realm, resourceName, ownerId, resourceType);
}

private void createHierarchicalGroupStructure(
    RealmModel realm,
    String resourceName,
    String ownerId,
    String resourceType
) {
    // Find or create parent group (organization)
    GroupModel parentGroup = session.groups().getGroupByName(realm, null, ownerId);
    if (parentGroup == null) {
        parentGroup = createGroupWithRoles(realm, ownerId, null, GROUP_TYPE_NONE);
    }

    // Create resource group under parent with role subgroups
    createGroupWithRoles(realm, resourceName, parentGroup, resourceType);
}
```

**Resource Deletion:**

```java
// Listens to: AUTHORIZATION_RESOURCE DELETE (only for tenant resources)
private void handleResourceDeletion(AdminEvent event) {
    String resourceType = extractFieldValue(representation, "type");

    // Only delete groups for tenant resources (organizations)
    if (RESOURCE_TYPE_TENANT.equals(resourceType)) {
        GroupModel group = session.groups().getGroupByName(realm, null, resourceName);
        session.groups().removeGroup(realm, group); // Cascades to subgroups
    }
}
```

#### 2. GroupResourcePolicyProvider

**File:** `keycloak/extensions/group-resource-policy/src/main/java/com/volaticloud/keycloak/GroupResourcePolicyProvider.java`

**Purpose:** Custom policy evaluator for group-based access control with hierarchical inheritance

**Policy Evaluation:**

```java
@Override
public void evaluate(Evaluation evaluation) {
    String userId = context.getIdentity().getId();
    String resourceName = evaluation.getPermission().getResource().getName();

    UserModel user = session.users().getUserById(realm, userId);
    GroupModel group = findGroupByName(session, realm, resourceName);

    // Extract required roles from policy configuration
    Set<String> requiredRoles = extractRolesFromPolicy(evaluation);

    // Check if user is member of required role in group hierarchy
    boolean hasAccess = checkRoleBasedMembership(user, group, requiredRoles);

    if (hasAccess) {
        evaluation.grant();
    }
}
```

**Hierarchical Role Check:**

```java
private boolean isUserMemberOfRoleInHierarchy(UserModel user, GroupModel group, String roleName) {
    Set<GroupModel> roleGroups = findRoleGroupsInHierarchy(group, roleName);
    return roleGroups.stream().anyMatch(roleGroup -> user.isMemberOf(roleGroup));
}

private void collectRoleGroupsRecursive(
    GroupModel group,
    String roleName,
    Set<GroupModel> roleGroups,
    Set<String> visited
) {
    // Check direct role subgroups
    String roleGroupName = "role:" + roleName;
    group.getSubGroupsStream()
        .filter(subGroup -> roleGroupName.equals(subGroup.getName()))
        .forEach(roleGroups::add);

    // Recursively check parent groups (inheritance)
    GroupModel parent = group.getParent();
    if (parent != null) {
        collectRoleGroupsRecursive(parent, roleName, roleGroups, visited);
    }
}
```

**How Inheritance Works:**

- User in `userId/role:admin` has access to all child resources (`userId/strategyId/`, `userId/botId/`, etc.)
- Policy checks traverse up the group hierarchy to find role membership
- If found in any ancestor group → permission granted

#### 3. ResourceManagementService

**File:** `keycloak/extensions/tenant-system/src/main/java/com/volaticloud/keycloak/tenant/services/ResourceManagementService.java`

**Purpose:** Unified REST API for atomic UMA resource + Keycloak group management (added in PR #112)

**Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/realms/{realm}/volaticloud/resources` | POST | Create UMA resource + group atomically |
| `/realms/{realm}/volaticloud/resources/{id}` | PUT | Update title and attributes, sync to group |
| `/realms/{realm}/volaticloud/resources/{id}` | GET | Get resource details |
| `/realms/{realm}/volaticloud/resources/{id}` | DELETE | Delete UMA resource + group atomically |

**Critical Implementation Detail - Global Group Search:**

The service uses `searchForGroupByNameStream(realm, resourceId, true, 0, 1)` instead of `getGroupByName(realm, null, resourceId)` because:

- Resources are nested under organization groups (e.g., `/orgId/strategyId/`)
- `getGroupByName(realm, null, resourceId)` only searches at root level (parent=null)
- `searchForGroupByNameStream()` searches globally across all nested hierarchies with exact match
- Parameters: `(realm, searchString, exact=true, firstResult=0, maxResults=1)`

**Example - Create Resource:**

```java
// Request
POST /realms/dev/volaticloud/resources
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My Trading Strategy",
  "type": "strategy",
  "ownerId": "orgId",
  "scopes": ["view", "edit", "delete"],
  "attributes": {
    "public": ["false"]
  }
}

// Implementation
public ResourceResponse createResource(ResourceCreateRequest request) {
    // 1. Validate inputs (UUID format, title length)
    // 2. Check resource doesn't already exist
    // 3. Find parent group by ownerId (global search)
    // 4. Create group with role subgroups (role:admin, role:viewer)
    // 5. Create UMA resource with attributes
    // 6. Sync GROUP_TYPE and GROUP_TITLE attributes
    return buildResourceResponse(resource, group, parentGroup);
}
```

**Example - Update Resource:**

```java
// Request
PUT /realms/dev/volaticloud/resources/{id}
{
  "title": "Updated Strategy Name"
}

// Implementation synchronizes:
// - UMA resource displayName
// - UMA resource "title" attribute
// - Keycloak group GROUP_TITLE attribute
```

**Transaction Boundaries:**

- Operations execute multiple Keycloak API calls within the same session
- If any step fails, an exception is thrown (caller handles rollback)
- Updates are applied to both UMA resource and group attributes
- No explicit transaction management (relies on Keycloak session semantics)

**Input Validation:**

- Resource ID must be valid UUID format
- Title must not exceed 255 characters
- Type field is required for create operations

**Used By:**

- `internal/authz/hooks.go` - ENT runtime hooks call `CreateResource()`, `UpdateResource()`, `DeleteResource()`
- Backend hooks run after database mutations, sync to Keycloak

**Transaction Rollback Strategy:**

The system uses **different consistency models** for create vs update operations:

| Operation | Strategy | Behavior on Keycloak Failure |
|-----------|----------|------------------------------|
| **Create** | Atomic (Strong Consistency) | Database transaction rolled back<br>Entity not persisted<br>User sees error |
| **Update** | Best-Effort (Eventual Consistency) | Database transaction commits<br>Warning logged<br>Keycloak out of sync |
| **Delete** | Best-Effort | Both deleted independently<br>Warnings logged if either fails |

**Rationale:**

- **Create requires atomicity**: A resource without UMA permissions would be inaccessible (broken state)
- **Updates tolerate inconsistency**: Database is source of truth. Title mismatches are non-critical.
- **Availability over strict consistency**: Updates don't fail just because Keycloak is temporarily unavailable

**Sync Failure Recovery:**

- **Monitoring**: Update hooks log warnings with resource IDs (grep for `"Warning: failed to update unified Keycloak resource"`)
- **Detection**: Compare database entity names with Keycloak GROUP_TITLE attributes
- **Manual fix**: Use Keycloak Admin Console to update GROUP_TITLE to match database
- **Future**: Implement reconciliation job with exponential backoff (see TODOs in `internal/authz/hooks.go:155-156`)

**Example Scenarios:**

```
Scenario 1: Create with Keycloak failure
1. Database creates Strategy entity
2. Keycloak CreateResource() fails (network timeout)
3. Hook returns error → ENT rolls back database transaction
4. Strategy NOT created in database
5. User sees error: "failed to create Keycloak resource"
Result: Consistent state (nothing created)

Scenario 2: Update with Keycloak failure
1. Database updates Strategy.name = "New Name"
2. Database transaction commits successfully
3. Keycloak UpdateResource() fails (Keycloak down)
4. Hook logs warning, continues execution
5. Strategy updated in database with new name
6. Keycloak still has old title (GROUP_TITLE = "Old Name")
Result: Temporary inconsistency (database ahead of Keycloak)
```

### C. UMA 2.0 Resource Protection

**Implementation:** `internal/keycloak/uma_client.go`

**Resource Registration:**

```go
func (u *UMAClient) CreateResource(
    ctx context.Context,
    resourceID, resourceName string,
    scopes []string,
    attributes map[string][]string,
) error {
    resource := gocloak.ResourceRepresentation{
        ID:          gocloak.StringP(resourceID),          // UUID
        Name:        gocloak.StringP(resourceID),          // Unique identifier
        DisplayName: gocloak.StringP(resourceName),        // Human-readable name
        Type:        gocloak.StringP("strategy"),          // Resource type
        Scopes:      &resourceScopes,                      // Available permissions
        Attributes:  &attributes,                          // ownerId, type
        OwnerManagedAccess: gocloak.BoolP(true),          // Enable UMA
    }

    return u.client.CreateResourceClient(ctx, token, u.realm, resource)
}
```

**Resource Types:**

- **Organization**: `type=urn:volaticloud:resources:tenant`, no `ownerId`
- **Sub-resources**: `type=strategy|bot|exchange|bot_runner`, `ownerId` points to parent organization

**Scopes (Permissions):**

- `view` - Read resource
- `edit` - Update resource
- `delete` - Delete resource
- `run` - Start bot/backtest
- `stop` - Stop bot/backtest
- `manage` - Full admin access
- `backtest` - Run backtest on strategy

**Permission Check:**

```go
func (u *UMAClient) CheckPermission(
    ctx context.Context,
    userToken, resourceID, scope string,
) (bool, error) {
    // Request Requesting Party Token (RPT) with permission
    permission := fmt.Sprintf("%s#%s", resourceID, scope)

    rpt, err := u.client.GetRequestingPartyToken(ctx, userToken, u.realm,
        gocloak.RequestingPartyTokenOptions{
            Permissions: &[]string{permission},
            Audience:    gocloak.StringP(u.clientID),
        })

    if err != nil {
        if IsAccessDenied(err) {
            return false, nil // Permission denied
        }
        return false, err // Error checking
    }

    // RPT token contains granted permissions
    return rpt != nil && rpt.AccessToken != "", nil
}
```

### D. GraphQL Authorization Directives

**File:** `internal/graph/schema.graphqls`

**Directive Definitions:**

```graphql
"""
Requires the request to be authenticated (valid JWT token)
Ensures user context is available in resolver
"""
directive @isAuthenticated on FIELD_DEFINITION

"""
Requires the user to have a specific permission scope on a resource
Uses Keycloak UMA 2.0 for fine-grained authorization
"""
directive @hasScope(
  """
  The resource ID argument name (e.g., "id" for mutations that take an ID)
  """
  resource: String!

  """
  The permission scope to check (e.g., "edit", "delete", "view", "backtest")
  """
  scope: String!
) on FIELD_DEFINITION

"""
Requires the user to have a specific permission scope on the parent node/object
Uses Keycloak UMA 2.0 for node-level field authorization
"""
directive @requiresPermission(
  """
  The permission scope to check (e.g., "view", "view:code", "edit")
  """
  scope: String!

  """
  The field name containing the resource ID in the parent object (defaults to "id")
  """
  idField: String = "id"
) on FIELD_DEFINITION
```

**Usage Examples:**

```graphql
type Query {
  # Requires authentication only
  strategyVersions(name: String!): [Strategy!]! @isAuthenticated
}

type Mutation {
  # Requires authentication + edit permission on strategy
  updateStrategy(id: ID!, input: UpdateStrategyInput!): Strategy!
    @hasScope(resource: "id", scope: "edit")

  # Requires authentication + delete permission
  deleteBot(id: ID!): Boolean!
    @hasScope(resource: "id", scope: "delete")

  # Requires authentication + run permission
  startBot(id: ID!): Bot!
    @hasScope(resource: "id", scope: "run")
}
```

**Implementation:** `internal/graph/directives.go`

**@isAuthenticated Directive:**

```go
func IsAuthenticatedDirective(
    ctx context.Context,
    obj interface{},
    next graphql.Resolver,
) (interface{}, error) {
    // Check if user context exists (JWT validated by auth middleware)
    _, err := auth.GetUserContext(ctx)
    if err != nil {
        return nil, fmt.Errorf("authentication required: %w", err)
    }

    // User is authenticated, proceed with resolver
    return next(ctx)
}
```

**@hasScope Directive:**

```go
func HasScopeDirective(
    ctx context.Context,
    obj interface{},
    next graphql.Resolver,
    resourceArg string,  // Argument containing resource ID
    scope string,        // Permission scope to check
) (interface{}, error) {
    // Get user context
    userCtx, err := auth.GetUserContext(ctx)
    if err != nil {
        return nil, fmt.Errorf("authentication required: %w", err)
    }

    // Extract resource ID from GraphQL arguments
    fc := graphql.GetFieldContext(ctx)
    resourceID, err := extractArgumentValue(fc.Args, resourceArg)
    if err != nil {
        return nil, fmt.Errorf("resource argument '%s' is required: %w", resourceArg, err)
    }

    // Get UMA client and ENT client from context
    umaClient := GetUMAClientFromContext(ctx)
    client := GetEntClientFromContext(ctx).(*ent.Client)

    // Verify permission (automatically detects resource type)
    hasPermission, err := verifyResourcePermission(
        ctx, client, umaClient, resourceID, userCtx.RawToken, scope)
    if err != nil {
        return nil, fmt.Errorf("permission check failed: %w", err)
    }

    if !hasPermission {
        return nil, fmt.Errorf("insufficient permissions: missing '%s' scope on resource %s",
            scope, resourceID)
    }

    // User has permission, proceed with resolver
    return next(ctx)
}
```

**Generic Permission Verification:**

```go
func verifyResourcePermission(
    ctx context.Context,
    client *ent.Client,
    umaClient keycloak.UMAClientInterface,
    resourceID, userToken, scope string,
) (bool, error) {
    id, err := uuid.Parse(resourceID)
    if err != nil {
        return false, fmt.Errorf("invalid resource ID: %w", err)
    }

    // Automatically detect resource type and verify
    if _, err := client.Strategy.Get(ctx, id); err == nil {
        return VerifyStrategyPermission(ctx, client, umaClient, resourceID, userToken, scope)
    }
    if _, err := client.Bot.Get(ctx, id); err == nil {
        return VerifyBotPermission(ctx, client, umaClient, resourceID, userToken, scope)
    }
    if _, err := client.Exchange.Get(ctx, id); err == nil {
        return VerifyExchangePermission(ctx, client, umaClient, resourceID, userToken, scope)
    }
    if _, err := client.BotRunner.Get(ctx, id); err == nil {
        return VerifyBotRunnerPermission(ctx, client, umaClient, resourceID, userToken, scope)
    }

    // Not found in database - might be Group resource (Keycloak-only)
    if umaClient != nil {
        return umaClient.CheckPermission(ctx, userToken, resourceID, scope)
    }

    return false, fmt.Errorf("resource not found: %s", resourceID)
}
```

**Resource-Specific Verification:**

```go
// internal/graph/keycloak_hooks.go
func VerifyStrategyPermission(
    ctx context.Context,
    client *ent.Client,
    umaClient keycloak.UMAClientInterface,
    strategyID, userToken, scope string,
) (bool, error) {
    if umaClient == nil {
        return false, fmt.Errorf("UMA client not available - authorization required")
    }

    // Check permission via Keycloak UMA
    hasPermission, err := umaClient.CheckPermission(ctx, userToken, strategyID, scope)
    if err != nil {
        return false, fmt.Errorf("permission check failed: %w", err)
    }

    return hasPermission, nil
}
```

### Flow Diagrams

**User Registration Flow:**

```
User self-registers (or admin creates user)
                  ↓
Event: USER_REGISTER or USER CREATE
                  ↓
TenantSystemEventListener triggered
                  ↓
Create UMA resource:
  - Name: userId (e.g., "550e8400-...")
  - Type: urn:volaticloud:resources:tenant
  - No ownerId (root-level)
                  ↓
Create group structure:
  userId/
  ├── role:admin  ← User added here
  └── role:viewer
                  ↓
User is now organization admin
```

**Resource Creation Flow (e.g., createStrategy):**

```
GraphQL mutation: createStrategy(input: {...})
                  ↓
@isAuthenticated directive checks JWT → ✓
                  ↓
Resolver calls CreateStrategyWithResource
                  ↓
Database transaction begins
                  ↓
ENT creates Strategy entity with ownerID=userId
                  ↓
UMAClient.CreateResource called:
  - ResourceID: strategyId (UUID)
  - Name: "MyStrategy (v1)"
  - Type: "strategy"
  - Attributes: {ownerId: [userId], type: ["strategy"]}
  - Scopes: [view, edit, backtest, delete]
                  ↓
Keycloak creates UMA resource
                  ↓
Event: AUTHORIZATION_RESOURCE CREATE
                  ↓
TenantSystemEventListener triggered
                  ↓
Create hierarchical group:
  userId/
  └── strategyId/
      ├── role:admin  ← Inherits from userId/role:admin
      └── role:viewer
                  ↓
Database transaction commits
                  ↓
Strategy created with automatic group structure
```

**Permission Check Flow (e.g., updateStrategy):**

```
GraphQL mutation: updateStrategy(id: "strategy-123", input: {...})
                  ↓
@hasScope(resource: "id", scope: "edit") directive
                  ↓
Extract resourceId from args: "strategy-123"
                  ↓
Extract JWT token from context
                  ↓
Call verifyResourcePermission(strategy-123, token, "edit")
                  ↓
UMAClient.CheckPermission(token, strategy-123, "edit")
                  ↓
Keycloak UMA Protection API:
  Request RPT (Requesting Party Token)
  Permission: "strategy-123#edit"
                  ↓
Keycloak evaluates policies:
  1. Find resource "strategy-123" in UMA registry
  2. Find GroupResourcePolicy attached to resource
  3. Extract ownerId attribute: "userId"
  4. GroupResourcePolicyProvider.evaluate() called:
     - Find group "strategy-123"
     - Check if user in "strategy-123/role:admin"
     - If not found, check parent "userId/role:admin"
     - If found → GRANT permission
     - If not found → DENY permission
                  ↓
If GRANTED:
  - Return RPT token
  - Directive returns next(ctx)
  - Resolver executes
  - Strategy updated
                  ↓
If DENIED:
  - Return access_denied error
  - Directive returns 403 Forbidden
  - Resolver never executes
```

**Hierarchical Access Example:**

```
User "alice" is in:
  alice/role:admin

Alice creates strategy "strat-123":
  alice/
  └── strat-123/
      ├── role:admin
      └── role:viewer

Alice tries to edit "strat-123":
  GraphQL: updateStrategy(id: "strat-123")
  Directive: @hasScope(resource: "id", scope: "edit")
  Permission check: "strat-123#edit"

  GroupResourcePolicyProvider checks:
    1. Is alice in "strat-123/role:admin"? NO
    2. Check parent group "alice/role:admin"? YES ✓
    3. GRANT permission (inherited from parent)

  Result: Alice can edit strategy (she's the org admin)

Alice adds Bob as viewer:
  Add bob to "strat-123/role:viewer"

Bob tries to edit "strat-123":
  Permission check: "strat-123#edit"

  GroupResourcePolicyProvider checks:
    1. Is bob in "strat-123/role:admin"? NO
    2. Is bob in "strat-123/role:viewer"? YES (but viewer != admin)
    3. Check parent "alice/role:admin"? NO (not bob's org)
    4. DENY permission

  Result: Bob can view strategy but not edit (viewer role)
```

### Resource Lifecycle

**Creation with Keycloak Registration:**

```go
// internal/graph/keycloak_hooks.go
func CreateStrategyWithResource(
    ctx context.Context,
    client *ent.Client,
    umaClient keycloak.UMAClientInterface,
    input ent.CreateStrategyInput,
    ownerID string,
) (*ent.Strategy, error) {
    // Database-first approach with transaction
    var strategy *ent.Strategy
    err := WithTx(ctx, client, func(tx *ent.Tx) error {
        // 1. Create Strategy in database
        strategy, err = tx.Strategy.Create().
            SetInput(input).
            SetOwnerID(ownerID).
            Save(ctx)
        if err != nil {
            return fmt.Errorf("failed to create strategy: %w", err)
        }

        // 2. Register as UMA resource
        if umaClient != nil {
            resourceName := fmt.Sprintf("%s (v%d)", strategy.Name, strategy.VersionNumber)
            attributes := map[string][]string{
                "ownerId": {ownerID},  // Parent organization ID
                "type":    {"strategy"},
            }

            err = umaClient.CreateResource(ctx, strategy.ID.String(),
                resourceName, StrategyScopes, attributes)
            if err != nil {
                // Keycloak failure → rollback database transaction
                return fmt.Errorf("failed to create Keycloak resource: %w", err)
            }
        }

        return nil // Commit transaction
    })

    return strategy, err
}
```

**Deletion with Cleanup:**

```go
func DeleteStrategyWithResource(
    ctx context.Context,
    client *ent.Client,
    umaClient keycloak.UMAClientInterface,
    strategyID string,
) error {
    // 1. Delete from database first
    id, err := uuid.Parse(strategyID)
    if err != nil {
        return fmt.Errorf("invalid strategy ID: %w", err)
    }

    err = client.Strategy.DeleteOneID(id).Exec(ctx)
    if err != nil {
        return fmt.Errorf("failed to delete strategy: %w", err)
    }

    // 2. Attempt to delete Keycloak resource (best effort)
    if umaClient != nil {
        err = umaClient.DeleteResource(ctx, strategyID)
        if err != nil {
            // Log but don't fail - database deletion already succeeded
            log.Printf("Warning: Strategy deleted from DB but Keycloak cleanup failed: %v", err)
        }
    }

    return nil
}
```

**Why Database-First?**

- Database is source of truth for entities
- Keycloak is authorization service, not data store
- Failed Keycloak registration → rollback database transaction
- Failed Keycloak deletion → log warning (database already cleaned up)

## Example Scenarios

### Scenario 1: New User Registration

**Action:** User registers with email/password

**Flow:**

1. Keycloak creates user account
2. Event: `USER_REGISTER` fired
3. `TenantSystemEventListener` triggered
4. Creates UMA resource: `name=userId, type=organization`
5. Creates group: `userId/role:admin` and `userId/role:viewer`
6. Adds user to `userId/role:admin`
7. User is now organization admin

**Result:** User has an organization with full admin permissions

### Scenario 2: User Creates Strategy

**Action:** `createStrategy` mutation

**Flow:**

1. GraphQL directive `@isAuthenticated` checks JWT → ✓
2. Resolver calls `CreateStrategyWithResource`
3. Database transaction:
   - Creates Strategy entity with `ownerID=userId`
   - Calls `UMAClient.CreateResource` with `ownerId=[userId]`
   - Keycloak creates UMA resource
   - Event: `AUTHORIZATION_RESOURCE CREATE`
   - `TenantSystemEventListener` creates group `userId/strategyId/role:admin`
   - Transaction commits
4. User is now strategy admin (inherited from `userId/role:admin`)

**Result:** Strategy created with automatic permission inheritance

### Scenario 3: User Shares Strategy with Viewer

**Action:** Add another user to strategy viewer role (via Keycloak admin or future GraphQL mutation)

**Steps:**

1. Admin adds `bob` to group `userId/strategyId/role:viewer`
2. Bob can now query the strategy (has `view` permission)
3. Bob cannot edit or delete (no `edit`/`delete` permission)

**Permission Check:**

```
Bob queries: strategy(id: "strategyId")
@hasScope(resource: "id", scope: "view")
  ↓
GroupResourcePolicyProvider checks:
  - Is bob in "strategyId/role:viewer"? YES ✓
  - GRANT permission
  ↓
Bob sees strategy data
```

### Scenario 4: User Tries to Edit Someone Else's Strategy

**Action:** User tries `updateStrategy` on strategy they don't own

**Flow:**

1. `@hasScope(resource: "id", scope: "edit")` directive
2. Extracts `strategyId` from args
3. Calls `UMAClient.CheckPermission(token, strategyId, "edit")`
4. Keycloak evaluates:
   - Find resource `strategyId` with `ownerId=aliceId`
   - Check if user in `aliceId/strategyId/role:admin` → NO
   - Check if user in `aliceId/role:admin` → NO (different organization)
   - DENY permission
5. Directive returns 403 Forbidden error
6. Resolver never executes

**Result:** User cannot edit strategy (not authorized)

### Scenario 5: Organization Admin Accesses All Resources

**Action:** User in `userId/role:admin` queries any child resource

**Flow:**

1. User creates bot: `createBot`
2. Group created: `userId/botId/role:admin`
3. User tries to edit bot: `updateBot(id: "botId")`
4. Permission check: `botId#edit`
5. GroupResourcePolicyProvider checks:
   - Is user in `userId/botId/role:admin`? NO
   - Check parent `userId/role:admin`? YES ✓
   - GRANT permission (inherited from organization)
6. User can edit bot

**Result:** Organization admins have full access to all sub-resources

## Validation

### How to Verify This Decision

**Manual Testing:**

1. Register new user → Check Keycloak groups show `userId/role:admin` and `userId/role:viewer`
2. Create strategy → Check UMA resource exists with `ownerId` attribute
3. Try editing strategy → Should succeed (owner)
4. Try editing from different user → Should fail (403 Forbidden)
5. Add viewer to strategy group → User can view but not edit

**Automated Tests:**

- `internal/graph/authorization_integration_test.go` - End-to-end authorization tests
- `internal/graph/directives_test.go` - Directive unit tests
- Test coverage: Permission checks, hierarchical inheritance, delegation

**Verification Checklist:**

- ✅ New users get automatic organization
- ✅ Resources registered as UMA resources
- ✅ Group structure mirrors resource hierarchy
- ✅ Organization admins can access all sub-resources
- ✅ Viewers can view but not edit
- ✅ Non-members get 403 Forbidden
- ✅ Permission checks complete < 100ms

## References

### Standards & Documentation

- [UMA 2.0 Specification](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html)
- [Keycloak Authorization Services](https://www.keycloak.org/docs/latest/authorization_services/)
- [OAuth 2.0 Resource Protection](https://www.oauth.com/oauth2-servers/resource-protection/)

### Implementation Files

**Keycloak Extensions (Java):**

- `keycloak/extensions/tenant-system/src/main/java/com/volaticloud/keycloak/TenantSystemEventListener.java` - Automatic group creation
- `keycloak/extensions/group-resource-policy/src/main/java/com/volaticloud/keycloak/GroupResourcePolicyProvider.java` - Group-based policy evaluator

**Backend (Go):**

- `internal/keycloak/doc.go` - UMA client documentation
- `internal/keycloak/uma_client.go` - UMA 2.0 client implementation
- `internal/graph/directives.go` - GraphQL authorization directives
- `internal/graph/keycloak_hooks.go` - Resource lifecycle management
- `internal/graph/schema.graphqls` - GraphQL directive definitions

**Tests:**

- `internal/graph/authorization_integration_test.go` - Integration tests
- `internal/graph/directives_test.go` - Unit tests

### Related ADRs

- [ADR-0001: Context-Based Dependency Injection](0001-context-based-dependency-injection.md) - How UMA client is injected via context
- [ADR-0002: ENT ORM with GraphQL Integration](0002-ent-orm-with-graphql.md) - How resources are stored in database
- [ADR-0007: Kubernetes Deployment Strategy](0007-kubernetes-deployment-strategy.md) - How Keycloak extensions are deployed

---

## Keycloak Setup Guide

This section provides step-by-step instructions for setting up Keycloak with VolatiCloud's multi-tenant authorization system.

### Prerequisites

- Keycloak 23+ server running and accessible
- Admin access to create realms and clients
- Understanding of OIDC and UMA 2.0 concepts

### Step 1: Create Realm

1. Log in to Keycloak Admin Console
2. Click **Create Realm**
3. Realm name: `volaticloud` (or use an existing realm)
4. Enable realm
5. Save

Alternatively, use an existing realm and adjust the `VOLATICLOUD_KEYCLOAK_REALM` environment variable.

### Step 2: Create Backend Client (volaticloud-api)

This client is used by the VolatiCloud backend for UMA resource management and service-to-service authentication.

**Navigate to:** Clients → Create Client

**General Settings:**

- Client ID: `volaticloud-api`
- Client Protocol: `openid-connect`
- Client Authentication: **ON** (confidential client)

**Capability Config:**

- Authorization: **ON** (enable UMA 2.0 resource server)
- Service accounts: **ON** (for backend resource management)

**Advanced Settings:**

- Access Type: `confidential`
- Standard Flow: **OFF** (backend doesn't use browser flow)
- Service Accounts: **ON**
- Authorization: **ON**

**Service Account Roles:**

After client creation, configure service account permissions:

1. Go to **Service Account Roles** tab
2. Assign realm-management role: `realm-admin`
   - Or create custom role with permissions to manage UMA resources
3. This allows the backend to register/delete UMA resources programmatically

**Client Secret:**

1. Go to **Credentials** tab
2. Copy the **Client Secret**
3. Set as `VOLATICLOUD_KEYCLOAK_CLIENT_SECRET` environment variable

### Step 3: Create Frontend Client (volaticloud-frontend)

This client is used by the React dashboard for user authentication.

**Navigate to:** Clients → Create Client

**General Settings:**

- Client ID: `volaticloud-frontend`
- Client Protocol: `openid-connect`
- Client Authentication: **OFF** (public client)

**Capability Config:**

- Standard Flow: **ON** (authorization code flow)
- Direct Access Grants: **ON** (for development/testing)
- Authorization: **OFF** (frontend doesn't manage resources)

**Valid Redirect URIs:**

Configure allowed redirect URIs for OAuth2 flow:

```
http://localhost:5173/*
http://localhost:3000/*
https://dashboard.volaticloud.com/*
```

**Web Origins:**

Configure CORS allowed origins:

```
http://localhost:5173
http://localhost:3000
https://dashboard.volaticloud.com
```

### Step 4: Enable UMA 2.0 Authorization

Configure the backend client for UMA 2.0 resource protection:

**For `volaticloud-api` client:**

1. Go to **Authorization** tab
2. Set **Policy Enforcement Mode**: `Enforcing`
3. Enable **Resource Server** settings
4. Configure authorization scopes (optional - VolatiCloud creates these programmatically)

**Scopes used by VolatiCloud:**

- `view` - View resource details
- `edit` - Update resource
- `backtest` - Run backtests (strategies)
- `delete` - Delete resource

### Step 5: Create Test User

Create a test user for development and testing:

**Navigate to:** Users → Add User

**User Details:**

- Username: `testuser`
- Email: `testuser@example.com`
- Email Verified: **ON**
- Enabled: **ON**

**Set Password:**

1. Go to **Credentials** tab
2. Click **Set Password**
3. Password: `your-password`
4. Temporary: **OFF** (don't require password change)
5. Save

### Testing Authentication

#### 1. Configure Environment Variables

Set the required Keycloak configuration:

```bash
export VOLATICLOUD_KEYCLOAK_URL=https://your-keycloak-server.com
export VOLATICLOUD_KEYCLOAK_REALM=volaticloud
export VOLATICLOUD_KEYCLOAK_CLIENT_ID=volaticloud-api
export VOLATICLOUD_KEYCLOAK_CLIENT_SECRET=your-secret-here
```

#### 2. Start the Server

```bash
./bin/volaticloud server
```

The server will fail to start if Keycloak configuration is missing or invalid.

#### 3. Obtain JWT Token

Get a JWT token using the password grant (for testing):

```bash
curl -X POST 'https://your-keycloak-server.com/realms/volaticloud/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=testuser' \
  -d 'password=your-password' \
  -d 'grant_type=password' \
  -d 'client_id=volaticloud-frontend'
```

Response:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI...",
  "expires_in": 300,
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "token_type": "Bearer"
}
```

#### 4. Use Token in GraphQL Requests

```bash
curl -X POST 'http://localhost:8080/query' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ latestStrategies { edges { node { id name } } } }"}'
```

#### 5. Test Resource Permissions

Create a strategy (automatically creates UMA resource):

```bash
curl -X POST 'http://localhost:8080/query' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "mutation { createStrategy(input: {name: \"TestStrategy\", code: \"print('test')\"}) { id name ownerID } }"
  }'
```

The backend will:

1. Verify JWT token
2. Create Strategy in database
3. Register UMA resource in Keycloak
4. Grant owner all permissions

### Permission Scopes

VolatiCloud defines the following permission scopes:

| Scope | Description | Automatically Granted To |
|-------|-------------|-------------------------|
| `view` | View resource details | Owner, Public resource viewers |
| `view-secrets` | View sensitive config (API keys, credentials) | Owner only |
| `edit` | Update resource code/config | Owner |
| `backtest` | Run backtests with strategy | Owner |
| `delete` | Delete resource | Owner |
| `run` | Start bot | Owner |
| `stop` | Stop bot | Owner |

**Automatic Permissions:**

- Resource owners automatically receive all scopes
- Permissions are verified before database operations
- Other users can be granted permissions via Keycloak policies
- Public resources grant `view` scope to all authenticated users (not `view-secrets`)

### Public/Private Visibility

Resources can be made public to allow any authenticated user to view them.

**Implementation:**

- `public` boolean field on Strategy, Bot, BotRunner, Exchange entities
- Default: `false` (private)
- Public resources are visible to all authenticated users
- Public resources hide sensitive data (`view-secrets` scope required)

**ENT Schema Mixin:**

```go
// internal/ent/mixin/public.go
type PublicMixin struct {
    mixin.Schema
}

func (PublicMixin) Fields() []ent.Field {
    return []ent.Field{
        field.Bool("public").
            Default(false).
            Comment("Whether this resource is publicly visible"),
    }
}
```

**GraphQL Mutations:**

```graphql
type Mutation {
    setStrategyVisibility(id: ID!, public: Boolean!): Strategy!
        @hasScope(resource: "id", scope: "edit")
    setBotVisibility(id: ID!, public: Boolean!): Bot!
        @hasScope(resource: "id", scope: "edit")
    setRunnerVisibility(id: ID!, public: Boolean!): BotRunner!
        @hasScope(resource: "id", scope: "edit")
}
```

**Keycloak Integration:**

When visibility changes, the `public` attribute is updated on the UMA resource:

```go
// internal/keycloak/uma_client.go
func (u *UMAClient) UpdateResource(ctx context.Context, resourceID string,
    attributes map[string][]string) error {
    // Update resource attributes including public=true/false
}
```

**Custom Keycloak Policy:**

A custom `PublicResourcePolicyProvider` grants access to resources with `public=true`:

```java
// keycloak/extensions/public-resource-policy/
public class PublicResourcePolicyProvider implements PolicyProvider {
    @Override
    public void evaluate(Evaluation evaluation) {
        Resource resource = evaluation.getPermission().getResource();
        Map<String, List<String>> attributes = resource.getAttributes();

        if (attributes.containsKey("public") &&
            attributes.get("public").contains("true")) {
            evaluation.grant();
        }
    }
}
```

### View-Secrets Scope

The `view-secrets` scope protects sensitive configuration fields separately from general `view` scope.

**Purpose:**

- Allow public resources to be viewable without exposing credentials
- Separate "can see resource exists" from "can see sensitive config"
- Enable sharing resources without credential exposure

**Protected Fields:**

| Entity | Field | Scope Required |
|--------|-------|----------------|
| Bot | `config` | `view-secrets` |
| Exchange | `config` | `view-secrets` |
| BotRunner | `config` | `view-secrets` |
| BotRunner | `dataDownloadConfig` | `view` |

**ENT Schema Annotation:**

```go
// internal/ent/schema/runner.go
field.JSON("config", map[string]interface{}{}).
    Annotations(
        entgql.Skip(entgql.SkipMutationCreateInput, entgql.SkipMutationUpdateInput),
        entgql.RequiresPermission(entgql.PermConfig{Scope: "view-secrets"}),
    )
```

**GraphQL Query Splitting:**

Dashboard uses separate queries to avoid fetching secrets unnecessarily:

```graphql
# List view - no secrets
query GetRunners {
    botRunners { edges { node { id name type public } } }
}

# Edit view - with secrets (lazy loaded)
query GetRunnerWithSecrets($id: ID!) {
    node(id: $id) {
        ... on BotRunner { id name config dataDownloadConfig }
    }
}
```

**Dashboard Implementation:**

```typescript
// RunnerSelector component
const [fetchRunnerSecrets] = useLazyQuery(GET_RUNNER_WITH_SECRETS);

// Only fetch secrets when editing
const handleEdit = (runner) => {
    fetchRunnerSecrets({ variables: { id: runner.id } });
};
```

### Troubleshooting

#### "Keycloak configuration is required"

**Cause:** Missing or invalid Keycloak environment variables

**Solutions:**

- Ensure all 4 environment variables are set:
  - `VOLATICLOUD_KEYCLOAK_URL`
  - `VOLATICLOUD_KEYCLOAK_REALM`
  - `VOLATICLOUD_KEYCLOAK_CLIENT_ID`
  - `VOLATICLOUD_KEYCLOAK_CLIENT_SECRET`
- Check that values are not empty strings
- Verify URL is accessible

#### "authentication required"

**Cause:** JWT token is missing or invalid

**Solutions:**

- Check Authorization header format: `Bearer <token>`
- Verify token hasn't expired (check `exp` claim)
- Ensure token was issued by correct Keycloak realm
- Verify client_id in token matches expected value

#### "insufficient permissions: missing 'edit' scope"

**Cause:** User doesn't have required permission on resource

**Solutions:**

- Check if you're the resource owner (compare `ownerID` with user's `sub` claim)
- Verify resource is registered in Keycloak UMA (check Keycloak Admin Console → Authorization → Resources)
- Check permission policies in Keycloak
- Verify UMA permission ticket was requested correctly

#### Check Keycloak Connectivity

Test OIDC discovery endpoint:

```bash
curl https://your-keycloak-server.com/realms/volaticloud/.well-known/openid-configuration
```

Should return JSON with issuer, authorization_endpoint, token_endpoint, etc.

#### Decode JWT Token

Inspect JWT token contents:

```bash
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq
```

Verify:

- `iss` (issuer) matches Keycloak URL
- `sub` (subject) is user ID
- `exp` (expiration) is in the future
- `azp` (authorized party) is correct client

### Environment Variables Reference

Complete list of Keycloak-related environment variables:

```bash
# Required
VOLATICLOUD_KEYCLOAK_URL=https://keycloak.volaticloud.com
VOLATICLOUD_KEYCLOAK_REALM=volaticloud
VOLATICLOUD_KEYCLOAK_CLIENT_ID=volaticloud-api
VOLATICLOUD_KEYCLOAK_CLIENT_SECRET=<secret-from-credentials-tab>

# Optional (defaults shown)
VOLATICLOUD_HOST=0.0.0.0
VOLATICLOUD_PORT=8080
```

### Next Steps

After completing Keycloak setup:

1. Review [UMA Integration Documentation](../../internal/keycloak/doc.go) for detailed UMA client API
2. Explore [Authorization Integration Tests](../../internal/graph/authorization_integration_test.go) for example scenarios
3. Configure production deployment with proper secrets management
4. Set up monitoring for Keycloak availability
5. Review the Implementation section above for details on hierarchical group structure and organization-level permissions

---

## Frontend Permission System

The React dashboard implements a streamlined permission checking system that integrates with the backend GraphQL API.

### Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  React Components   │    │  PermissionContext   │    │  GraphQL API    │
│                     │    │                      │    │                 │
│  • usePermissions   │───▶│  • Auto-batching     │───▶│ checkPermissions│
│  • useCanPerform    │    │  • 50ms batch window │    │ query           │
│  • PermissionGate   │    │  • Deduplication     │    │                 │
│  • ProtectedButton  │    │  • Caching           │    │ Backend calls   │
│                     │    │                      │    │ Keycloak + sync │
└─────────────────────┘    └──────────────────────┘    └─────────────────┘
```

### Key Design Decisions

**1. Backend Proxy Instead of Direct Keycloak:**

The frontend calls a GraphQL `checkPermissions` query instead of directly calling Keycloak. Benefits:

- Backend triggers self-healing when new scopes are added
- Single source of truth for permission logic
- No Keycloak credentials exposed to frontend
- Simplified CORS configuration

**2. Auto-Request Pattern:**

Permissions are automatically fetched when `can()` is called:

```typescript
// Simple usage - no useEffect needed!
const { can } = usePermissions();
const canEdit = can(bot.id, 'edit');  // Auto-fetches if not cached
```

**3. Request Batching:**

Multiple permission checks within 50ms are batched into a single GraphQL request:

```typescript
// These three calls become ONE GraphQL request
const canEdit = can(bot.id, 'edit');
const canDelete = can(bot.id, 'delete');
const canRun = can(bot.id, 'run');
```

### Components and Hooks

**`usePermissions`** - Main hook for permission checking:

```typescript
const { can, loading, refresh } = usePermissions();

// Check permission (auto-fetches if not cached)
const canEdit = can(resourceId, 'edit');

// Force refresh all cached permissions
await refresh();
```

**`useCanPerform`** - Single permission check with loading state:

```typescript
const { can, loading } = useCanPerform({
  resourceId: strategy.id,
  scope: 'edit',
  skip: !isEditing, // Optional: skip check conditionally
});
```

**`PermissionGate`** - Conditional rendering based on permission:

```typescript
<PermissionGate resourceId={bot.id} scope="edit">
  <EditButton />
</PermissionGate>
```

**`ProtectedButton`** - Button with built-in permission check:

```typescript
<ProtectedButton
  resourceId={bot.id}
  scope="delete"
  deniedTooltip="No permission to delete"
  hideWhenDenied
>
  Delete
</ProtectedButton>
```

### Self-Healing Flow

When new scopes are added to the codebase:

1. Frontend calls `can(resourceId, 'new-scope')`
2. GraphQL `checkPermissions` query sent to backend
3. Backend checks Keycloak UMA
4. If scope doesn't exist → self-healing triggers
5. Backend syncs scopes to Keycloak resource
6. Re-checks permission
7. Returns result to frontend

This eliminates the need for manual scope migrations when adding new permissions.

### Permission Scopes by Resource Type

| Resource | Available Scopes |
|----------|-----------------|
| Bot | `view`, `view-secrets`, `run`, `stop`, `delete`, `edit`, `freqtrade-api`, `make-public`, `create-alert-rule`, `update-alert-rule`, `delete-alert-rule`, `view-alert-rules` |
| Strategy | `view`, `edit`, `delete`, `run-backtest`, `stop-backtest`, `delete-backtest`, `make-public`, `create-alert-rule`, `update-alert-rule`, `delete-alert-rule`, `view-alert-rules` |
| Exchange | `view`, `view-secrets`, `edit`, `delete` |
| BotRunner | `view`, `view-secrets`, `edit`, `delete`, `make-public`, `create-alert-rule`, `update-alert-rule`, `delete-alert-rule`, `view-alert-rules` |
| Group | `view`, `edit`, `delete`, `mark-alert-as-read`, `create-alert-rule`, `update-alert-rule`, `delete-alert-rule`, `view-alert-rules` |

### Implementation Files

**Frontend:**

- `dashboard/src/contexts/PermissionContext.tsx` - Provider with batching logic
- `dashboard/src/hooks/usePermissions.ts` - Main permission hook
- `dashboard/src/hooks/useCanPerform.ts` - Single permission hook
- `dashboard/src/components/shared/PermissionGate.tsx` - Conditional render component
- `dashboard/src/components/shared/ProtectedButton.tsx` - Protected button components
- `dashboard/src/services/permissions/types.ts` - TypeScript type definitions
- `dashboard/src/services/permissions/permissions.graphql` - GraphQL query

**Backend:**

- `internal/graph/schema.graphqls` - `checkPermissions` query definition
- `internal/graph/schema.resolvers.go` - Query resolver with self-healing
- `internal/authz/scopes.go` - Scope definitions and self-healing detection
