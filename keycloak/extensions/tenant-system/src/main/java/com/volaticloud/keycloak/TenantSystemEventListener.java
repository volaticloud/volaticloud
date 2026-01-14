package com.volaticloud.keycloak;

import lombok.RequiredArgsConstructor;
import lombok.extern.jbosslog.JBossLog;
import org.keycloak.authorization.AuthorizationProvider;
import org.keycloak.authorization.model.Resource;
import org.keycloak.authorization.model.ResourceServer;
import org.keycloak.authorization.model.Scope;
import org.keycloak.authorization.store.ResourceStore;
import org.keycloak.authorization.store.ScopeStore;
import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.OperationType;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.*;
import org.keycloak.organization.OrganizationProvider;

import java.util.HashSet;
import java.util.Set;

/**
 * Multi-tenant system event listener that manages hierarchical group structures.
 *
 * Handles the following events:
 * 1. USER creation (admin or self-signup) - Creates organization structure for each user
 *
 * Note: AUTHORIZATION_RESOURCE creation/deletion is now handled by the unified API
 * (/realms/{realm}/volaticloud/resources endpoint). This event listener only handles
 * user organization creation.
 */
@JBossLog
@RequiredArgsConstructor
public class TenantSystemEventListener implements EventListenerProvider {

    private static final String VOLATICLOUD_CLIENT = "volaticloud";
    private static final String ROLE_ADMIN = "role:admin";
    private static final String ROLE_VIEWER = "role:viewer";
    private static final String DEFAULT_INVITATION_ROLE = "viewer";
    private static final String GROUP_TYPE_ATTRIBUTE = "GROUP_TYPE";
    private static final String GROUP_TITLE_ATTRIBUTE = "GROUP_TITLE";
    private static final String GROUP_TYPE_ORGANIZATION = "organization";
    private static final String GROUP_TYPE_NONE = "none";
    private static final String RESOURCE_TYPE_TENANT = "urn:volaticloud:resources:tenant";

    /**
     * Group/Organization resource scopes.
     * These must match GroupScopes in Go backend (internal/authz/scopes.go).
     * Includes: basic permissions, alert management, and user management.
     */
    private static final String[] GROUP_SCOPES = {
        "view", "edit", "delete",
        "mark-alert-as-read", "view-users", "invite-user",
        "create-alert-rule", "update-alert-rule", "delete-alert-rule", "view-alert-rules"
    };

    private final KeycloakSession session;

    @Override
    public void onEvent(Event event) {
        log.infof("Regular event received: type=%s, userId=%s", event.getType(), event.getUserId());

        // Handle user registration (self-signup)
        if (event.getType() == EventType.REGISTER) {
            try {
                handleUserRegistration(event);
            } catch (Exception e) {
                log.errorf(e, "Error processing user registration event");
            }
        }
    }

    @Override
    public void onEvent(AdminEvent event, boolean includeRepresentation) {
        log.infof("Admin event received: type=%s, operation=%s, path=%s",
                  event.getResourceType(), event.getOperationType(), event.getResourcePath());

        try {
            // Handle CREATE operations
            if (event.getOperationType() == OperationType.CREATE) {
                // Handle USER creation
                if (event.getResourceType() == ResourceType.USER) {
                    handleUserCreation(event);
                    return;
                }

                // Handle ORGANIZATION_MEMBERSHIP CREATE (member added to org via invitation)
                if (event.getResourceType() == ResourceType.ORGANIZATION_MEMBERSHIP) {
                    handleOrganizationMemberAdded(event);
                    return;
                }

                // NOTE: AUTHORIZATION_RESOURCE creation is now handled by the unified API
                // (/realms/{realm}/volaticloud/resources endpoint)
                // This event listener only handles user creation events
            }

            // NOTE: AUTHORIZATION_RESOURCE deletion is now handled by the unified API
            // (/realms/{realm}/volaticloud/resources/{id} DELETE endpoint)
            // This event listener does not handle resource deletion
        } catch (Exception e) {
            log.errorf(e, "Error processing admin event for tenant system");
        }
    }

    /**
     * Handles user registration event (self-signup).
     * Creates a group named with user's UUID and adds user to the admin role subgroup.
     */
    private void handleUserRegistration(Event event) {
        String userId = event.getUserId();
        if (userId == null || userId.isEmpty()) {
            log.warn("No user ID found in registration event");
            return;
        }

        log.infof("Processing user registration: userId=%s", userId);

        // Get the realm
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            log.error("Could not get realm from session context");
            return;
        }

        // Get the user
        UserModel user = session.users().getUserById(realm, userId);
        if (user == null) {
            log.errorf("Could not find user with ID: %s", userId);
            return;
        }

        // Create tenant structure for the user
        createTenantStructureForUser(realm, user, userId);

        // Check if user was invited to any organization and add them to the viewer role
        // This handles the case where user registered via invitation link
        addInvitedUserToViewerRole(realm, user);
    }

    /**
     * Handles user creation event by admin.
     * Creates a group named with user's UUID and adds user to the admin role subgroup.
     */
    private void handleUserCreation(AdminEvent event) {
        String representation = event.getRepresentation();
        if (representation == null) {
            log.warn("No representation found in user creation event");
            return;
        }

        // Extract user ID from event path (e.g., "users/uuid")
        String resourcePath = event.getResourcePath();
        String userId = extractUserIdFromPath(resourcePath);

        if (userId == null || userId.isEmpty()) {
            log.warn("Could not extract user ID from path: " + resourcePath);
            return;
        }

        log.infof("Processing user creation (admin): userId=%s", userId);

        // Get the realm
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            log.error("Could not get realm from session context");
            return;
        }

        // Get the user
        UserModel user = session.users().getUserById(realm, userId);
        if (user == null) {
            log.errorf("Could not find user with ID: %s", userId);
            return;
        }

        // Create tenant structure for the user
        createTenantStructureForUser(realm, user, userId);
    }

    /**
     * Checks if a newly registered user is a member of any native organizations
     * (other than their own) and adds them to the viewer role subgroup.
     *
     * <p>This handles the case where a user registers via an invitation link.
     * Keycloak's InviteOrgActionToken automatically adds them to the native organization,
     * but we need to also add them to our custom role subgroup structure.
     */
    private void addInvitedUserToViewerRole(RealmModel realm, UserModel user) {
        OrganizationProvider orgProvider = session.getProvider(OrganizationProvider.class);
        if (orgProvider == null) {
            log.warn("OrganizationProvider not available, skipping invited user role assignment");
            return;
        }

        // Get all organizations the user is a member of
        orgProvider.getByMember(user).forEach(org -> {
            String orgAlias = org.getAlias();
            if (orgAlias == null) {
                log.warnf("Organization %s has no alias, skipping", org.getId());
                return;
            }

            // Skip the user's own organization (created during registration)
            if (orgAlias.equals(user.getId())) {
                return;
            }

            log.infof("User %s is member of organization %s (alias: %s), adding to viewer role",
                     user.getId(), org.getId(), orgAlias);

            // Find the resource group by org alias
            GroupModel resourceGroup = session.groups()
                .searchForGroupByNameStream(realm, orgAlias, true, 0, 1)
                .findFirst()
                .orElse(null);

            if (resourceGroup == null) {
                log.warnf("Resource group not found for org alias: %s", orgAlias);
                return;
            }

            // Check if user is already in a role subgroup for this organization
            boolean hasRole = user.getGroupsStream()
                .anyMatch(g -> g.getParent() != null &&
                              g.getParent().getName().equals(orgAlias) &&
                              (g.getName().equals(ROLE_ADMIN) || g.getName().equals(ROLE_VIEWER)));

            if (hasRole) {
                log.infof("User %s already has a role in organization %s, skipping", user.getId(), orgAlias);
                return;
            }

            // Add user to default role subgroup (viewer)
            GroupModel roleGroup = session.groups().getGroupByName(realm, resourceGroup, ROLE_VIEWER);
            if (roleGroup == null) {
                roleGroup = session.groups().createGroup(realm, ROLE_VIEWER, resourceGroup);
                log.infof("Created role group: %s under %s", ROLE_VIEWER, orgAlias);
            }
            user.joinGroup(roleGroup);
            log.infof("Added invited user %s to %s role in organization %s", user.getId(), DEFAULT_INVITATION_ROLE, orgAlias);
        });
    }

    /**
     * Handles organization member addition event (e.g., when user accepts invitation).
     * Automatically adds the user to the default role subgroup (viewer).
     *
     * <p>Note: This event may not fire in all Keycloak versions/configurations.
     * The {@link #addInvitedUserToViewerRole} method provides a fallback during registration.
     */
    private void handleOrganizationMemberAdded(AdminEvent event) {
        // Extract org ID and user ID from path: organizations/{orgId}/members/{userId}
        String path = event.getResourcePath();
        String[] parts = path.split("/");
        // Expected: organizations/{orgId}/members/{userId}

        if (parts.length < 4) {
            log.warnf("Unexpected path format for organization membership: %s", path);
            return;
        }

        String orgId = null;
        String userId = null;
        for (int i = 0; i < parts.length - 1; i++) {
            if ("organizations".equals(parts[i])) {
                orgId = parts[i + 1];
            } else if ("members".equals(parts[i])) {
                userId = parts[i + 1];
            }
        }

        if (orgId == null || userId == null) {
            log.warnf("Could not parse org/user from path: %s", path);
            return;
        }

        log.infof("Processing organization member added: orgId=%s, userId=%s", orgId, userId);

        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            log.error("Could not get realm from session context");
            return;
        }

        UserModel user = session.users().getUserById(realm, userId);
        if (user == null) {
            log.warnf("User not found: %s", userId);
            return;
        }

        // Find resource group by org alias
        // The orgId from native organization is the UUID, but our groups use the alias
        // We need to look up the org to get the alias
        OrganizationProvider orgProvider = session.getProvider(OrganizationProvider.class);
        if (orgProvider == null) {
            log.warn("OrganizationProvider not available");
            return;
        }

        OrganizationModel org = orgProvider.getById(orgId);
        if (org == null) {
            log.warnf("Organization not found: %s", orgId);
            return;
        }

        String orgAlias = org.getAlias();
        if (orgAlias == null) {
            log.warnf("Organization has no alias: %s", orgId);
            return;
        }

        GroupModel resourceGroup = session.groups()
            .searchForGroupByNameStream(realm, orgAlias, true, 0, 1)
            .findFirst()
            .orElse(null);

        if (resourceGroup == null) {
            log.warnf("Resource group not found for org alias: %s", orgAlias);
            return;
        }

        // Idempotency check: skip if user already has a role in this organization
        boolean hasRole = user.getGroupsStream()
            .anyMatch(g -> g.getParent() != null &&
                          g.getParent().getName().equals(orgAlias) &&
                          (g.getName().equals(ROLE_ADMIN) || g.getName().equals(ROLE_VIEWER)));

        if (hasRole) {
            log.infof("User %s already has a role in organization %s, skipping duplicate assignment", userId, orgAlias);
            return;
        }

        // Add user to default role subgroup (viewer)
        String roleGroupName = "role:" + DEFAULT_INVITATION_ROLE;
        GroupModel roleGroup = session.groups().getGroupByName(realm, resourceGroup, roleGroupName);
        if (roleGroup == null) {
            roleGroup = session.groups().createGroup(realm, roleGroupName, resourceGroup);
            log.infof("Created role group: %s under %s", roleGroupName, orgAlias);
        }
        user.joinGroup(roleGroup);
        log.infof("Added user %s to default role group %s via invitation acceptance", userId, roleGroupName);
    }

    /**
     * Creates tenant structure for a user (works for both admin-created and self-registered users).
     * Creates a UMA resource with type=organization, then creates the corresponding group structure.
     * Finally adds user to the admin role subgroup.
     */
    private void createTenantStructureForUser(RealmModel realm, UserModel user, String userId) {
        // Step 1: Create UMA resource with type=organization (no ownerId - root level)
        Resource resource = createOrganizationResource(realm, userId);
        if (resource == null) {
            log.errorf("Failed to create organization resource for user: %s", userId);
            return;
        }
        log.infof("Created organization resource for user: %s", userId);

        // Step 2: Generate organization title
        String organizationTitle = generateOrganizationTitle(user);

        // Step 3: Create group structure (same logic as handleResourceCreation)
        createHierarchicalGroupStructure(realm, userId, null, GROUP_TYPE_ORGANIZATION, organizationTitle);

        // Step 4: Add user to admin role subgroup
        GroupModel userGroup = session.groups().getGroupByName(realm, null, userId);
        if (userGroup == null) {
            log.errorf("Could not find tenant group for user: %s", userId);
            return;
        }

        GroupModel adminRole = session.groups().getGroupByName(realm, userGroup, ROLE_ADMIN);
        if (adminRole != null) {
            user.joinGroup(adminRole);
            log.infof("Added user %s to admin role group", userId);
        } else {
            log.errorf("Could not find admin role group for user: %s", userId);
        }

        log.infof("Successfully created tenant structure (resource + groups) for user: %s", userId);
    }

    /**
     * Generates organization title based on user's first name or email.
     * Format: "{Name}'s Organization"
     * If firstName is available, uses it. Otherwise extracts username from email.
     */
    private String generateOrganizationTitle(UserModel user) {
        String name = user.getFirstName();

        // If no firstName, extract username from email
        if (name == null || name.trim().isEmpty()) {
            String email = user.getEmail();
            if (email != null && email.contains("@")) {
                name = email.substring(0, email.indexOf("@"));
            }
        }

        // Fallback to "User" if still empty
        if (name == null || name.trim().isEmpty()) {
            name = "User";
        }

        return name + "'s Organization";
    }

    /**
     * Creates a UMA resource for an organization in the volaticloud client.
     * Resource has type urn:volaticloud:resources:tenant and no ownerId (root-level).
     */
    private Resource createOrganizationResource(RealmModel realm, String resourceName) {
        try {
            ClientModel client = realm.getClientByClientId(VOLATICLOUD_CLIENT);
            if (client == null) {
                log.errorf("Client '%s' not found", VOLATICLOUD_CLIENT);
                return null;
            }

            AuthorizationProvider authz = session.getProvider(AuthorizationProvider.class);
            ResourceServer resourceServer = authz.getStoreFactory().getResourceServerStore()
                .findByClient(client);

            if (resourceServer == null) {
                log.errorf("Resource server not found for client '%s'", VOLATICLOUD_CLIENT);
                return null;
            }

            ResourceStore resourceStore = authz.getStoreFactory().getResourceStore();

            // Check if resource already exists
            Resource existing = resourceStore.findByName(resourceServer, resourceName);
            if (existing != null) {
                log.infof("Organization resource '%s' already exists", resourceName);
                return existing;
            }

            // Get or create scopes (matching GroupScopes from Go backend)
            ScopeStore scopeStore = authz.getStoreFactory().getScopeStore();
            Set<Scope> scopes = new HashSet<>();
            for (String scopeName : GROUP_SCOPES) {
                Scope scope = scopeStore.findByName(resourceServer, scopeName);
                if (scope == null) {
                    scope = scopeStore.create(resourceServer, scopeName);
                    log.infof("Created scope: %s", scopeName);
                }
                scopes.add(scope);
            }

            // Create resource
            Resource resource = resourceStore.create(resourceServer, resourceName, resourceServer.getClientId());

            // Set resource type URN (no ownerId for root-level organization)
            resource.setType(RESOURCE_TYPE_TENANT);

            // Set scopes
            resource.updateScopes(scopes);

            log.infof("Created organization resource: %s with type=%s", resourceName, RESOURCE_TYPE_TENANT);
            return resource;
        } catch (Exception e) {
            log.errorf(e, "Error creating organization resource: %s", resourceName);
            return null;
        }
    }

    /**
     * Extracts user ID from resource path like "users/uuid" or "users/uuid/..."
     */
    private String extractUserIdFromPath(String path) {
        if (path == null || !path.contains("users/")) {
            return null;
        }

        try {
            int usersIndex = path.indexOf("users/");
            String afterUsers = path.substring(usersIndex + 6); // "users/" is 6 chars

            // Get the UUID (first segment after users/)
            int slashIndex = afterUsers.indexOf('/');
            if (slashIndex > 0) {
                return afterUsers.substring(0, slashIndex);
            } else {
                return afterUsers;
            }
        } catch (Exception e) {
            log.errorf(e, "Error extracting user ID from path: %s", path);
            return null;
        }
    }

    /**
     * Creates hierarchical group structure.
     * If parent group doesn't exist, creates it automatically with role subgroups.
     */
    private void createHierarchicalGroupStructure(RealmModel realm, String resourceName, String ownerId, String resourceType, String resourceTitle) {
        GroupModel parentGroup = null;

        // If ownerId is provided, get or create parent group
        if (ownerId != null && !ownerId.isEmpty()) {
            // Try to find existing parent group
            parentGroup = session.groups().getGroupByName(realm, null, ownerId);

            if (parentGroup == null) {
                // Parent group doesn't exist - create it with role subgroups
                // Use GROUP_TYPE_NONE for auto-created parent groups (owner resource not yet created)
                log.infof("Parent group '%s' not found, creating it automatically", ownerId);
                parentGroup = createGroupWithRoles(realm, ownerId, null, GROUP_TYPE_NONE, ownerId);
                log.infof("Created parent group: %s", ownerId);
            } else {
                log.infof("Found existing parent group: %s", ownerId);
                // Ensure role subgroups exist
                ensureRoleSubgroupsExist(realm, parentGroup);
            }

            // Check if parent resource exists (just for logging)
            Resource parentResource = findResourceByName(realm, ownerId);
            if (parentResource == null) {
                log.warnf("Parent resource '%s' does not exist yet. It should be created separately.", ownerId);
            } else {
                log.infof("Found parent resource: %s", ownerId);
            }
        }

        // Create resource group under parent (or at root if no parent)
        createGroupWithRoles(realm, resourceName, parentGroup, resourceType, resourceTitle);
    }

    /**
     * Finds a resource by name in the volaticloud client.
     */
    private Resource findResourceByName(RealmModel realm, String resourceName) {
        try {
            ClientModel client = realm.getClientByClientId(VOLATICLOUD_CLIENT);
            if (client == null) {
                log.warnf("Client '%s' not found", VOLATICLOUD_CLIENT);
                return null;
            }

            AuthorizationProvider authz = session.getProvider(AuthorizationProvider.class);
            ResourceServer resourceServer = authz.getStoreFactory().getResourceServerStore()
                .findByClient(client);

            if (resourceServer == null) {
                log.warnf("Resource server not found for client '%s'", VOLATICLOUD_CLIENT);
                return null;
            }

            ResourceStore resourceStore = authz.getStoreFactory().getResourceStore();
            return resourceStore.findByName(resourceServer, resourceName);
        } catch (Exception e) {
            log.errorf(e, "Error finding resource by name: %s", resourceName);
            return null;
        }
    }

    /**
     * Creates a new group with role subgroups, GROUP_TYPE and GROUP_TITLE attributes.
     * Also creates a corresponding UMA resource with proper attributes.
     * Returns the created or existing group.
     */
    private GroupModel createGroupWithRoles(RealmModel realm, String groupName, GroupModel parentGroup, String groupType, String groupTitle) {
        // Check if group already exists
        GroupModel existingGroup = session.groups().getGroupByName(realm, parentGroup, groupName);

        if (existingGroup != null) {
            log.infof("Group %s already exists under parent %s - skipping creation",
                     groupName, parentGroup != null ? parentGroup.getName() : "root");
            // Ensure role subgroups exist
            ensureRoleSubgroupsExist(realm, existingGroup);

            // Update GROUP_TYPE attribute if not set
            if (!existingGroup.getAttributes().containsKey(GROUP_TYPE_ATTRIBUTE)) {
                existingGroup.setSingleAttribute(GROUP_TYPE_ATTRIBUTE, groupType);
                log.infof("Set GROUP_TYPE=%s for existing group: %s", groupType, groupName);
            }

            // Update GROUP_TITLE attribute if not set
            if (!existingGroup.getAttributes().containsKey(GROUP_TITLE_ATTRIBUTE)) {
                existingGroup.setSingleAttribute(GROUP_TITLE_ATTRIBUTE, groupTitle);
                log.infof("Set GROUP_TITLE=%s for existing group: %s", groupTitle, groupName);
            }

            // Ensure UMA resource exists for this group
            ensureUMAResourceExists(realm, groupName, parentGroup, groupTitle);

            return existingGroup;
        }

        // Create new group
        GroupModel group = session.groups().createGroup(realm, groupName, parentGroup);

        // Set GROUP_TYPE attribute
        group.setSingleAttribute(GROUP_TYPE_ATTRIBUTE, groupType);

        // Set GROUP_TITLE attribute
        group.setSingleAttribute(GROUP_TITLE_ATTRIBUTE, groupTitle);

        log.infof("Created group: %s under parent: %s with GROUP_TYPE=%s, GROUP_TITLE=%s",
                 groupName, parentGroup != null ? parentGroup.getName() : "root", groupType, groupTitle);

        // Create role subgroups
        createRoleSubgroups(realm, group);

        // Create UMA resource for this group
        createUMAResourceForGroup(realm, groupName, parentGroup, groupTitle);

        return group;
    }

    /**
     * Creates role:admin and role:viewer subgroups under a parent group.
     */
    private void createRoleSubgroups(RealmModel realm, GroupModel parentGroup) {
        session.groups().createGroup(realm, ROLE_ADMIN, parentGroup);
        log.infof("Created subgroup: %s under %s", ROLE_ADMIN, parentGroup.getName());

        session.groups().createGroup(realm, ROLE_VIEWER, parentGroup);
        log.infof("Created subgroup: %s under %s", ROLE_VIEWER, parentGroup.getName());
    }

    /**
     * Ensures that role subgroups exist for a group.
     * Creates them if they don't exist.
     */
    private void ensureRoleSubgroupsExist(RealmModel realm, GroupModel parentGroup) {
        // Check if role:admin exists
        GroupModel adminGroup = session.groups().getGroupByName(realm, parentGroup, ROLE_ADMIN);
        if (adminGroup == null) {
            session.groups().createGroup(realm, ROLE_ADMIN, parentGroup);
            log.infof("Created missing subgroup: %s under %s", ROLE_ADMIN, parentGroup.getName());
        }

        // Check if role:viewer exists
        GroupModel viewerGroup = session.groups().getGroupByName(realm, parentGroup, ROLE_VIEWER);
        if (viewerGroup == null) {
            session.groups().createGroup(realm, ROLE_VIEWER, parentGroup);
            log.infof("Created missing subgroup: %s under %s", ROLE_VIEWER, parentGroup.getName());
        }
    }

    /**
     * Ensures a UMA resource exists for the given group.
     * If resource doesn't exist, creates it with proper attributes.
     * This is used when groups already exist but their UMA resources might be missing.
     */
    private void ensureUMAResourceExists(RealmModel realm, String groupName, GroupModel parentGroup, String groupTitle) {
        try {
            ClientModel client = realm.getClientByClientId(VOLATICLOUD_CLIENT);
            if (client == null) {
                log.warnf("Client '%s' not found, cannot ensure UMA resource", VOLATICLOUD_CLIENT);
                return;
            }

            AuthorizationProvider authz = session.getProvider(AuthorizationProvider.class);
            ResourceServer resourceServer = authz.getStoreFactory().getResourceServerStore()
                .findByClient(client);

            if (resourceServer == null) {
                log.warnf("Resource server not found for client '%s'", VOLATICLOUD_CLIENT);
                return;
            }

            ResourceStore resourceStore = authz.getStoreFactory().getResourceStore();

            // Check if resource already exists
            Resource existing = resourceStore.findByName(resourceServer, groupName);
            if (existing != null) {
                log.infof("UMA resource '%s' already exists", groupName);
                return;
            }

            // Create the resource
            createUMAResourceForGroup(realm, groupName, parentGroup, groupTitle);
        } catch (Exception e) {
            log.errorf(e, "Error ensuring UMA resource exists for group: %s", groupName);
        }
    }

    /**
     * Creates a UMA resource for a child group/organization.
     * Sets proper attributes including ownerId (parent group ID) and title.
     * This enables permission checks on child groups.
     */
    private void createUMAResourceForGroup(RealmModel realm, String groupName, GroupModel parentGroup, String groupTitle) {
        try {
            ClientModel client = realm.getClientByClientId(VOLATICLOUD_CLIENT);
            if (client == null) {
                log.errorf("Client '%s' not found, cannot create UMA resource", VOLATICLOUD_CLIENT);
                return;
            }

            AuthorizationProvider authz = session.getProvider(AuthorizationProvider.class);
            ResourceServer resourceServer = authz.getStoreFactory().getResourceServerStore()
                .findByClient(client);

            if (resourceServer == null) {
                log.errorf("Resource server not found for client '%s'", VOLATICLOUD_CLIENT);
                return;
            }

            ResourceStore resourceStore = authz.getStoreFactory().getResourceStore();

            // Check if resource already exists
            Resource existing = resourceStore.findByName(resourceServer, groupName);
            if (existing != null) {
                log.infof("UMA resource '%s' already exists, skipping creation", groupName);
                return;
            }

            // Get or create scopes
            ScopeStore scopeStore = authz.getStoreFactory().getScopeStore();
            Set<Scope> scopes = new HashSet<>();
            for (String scopeName : GROUP_SCOPES) {
                Scope scope = scopeStore.findByName(resourceServer, scopeName);
                if (scope == null) {
                    scope = scopeStore.create(resourceServer, scopeName);
                    log.infof("Created scope: %s", scopeName);
                }
                scopes.add(scope);
            }

            // Create resource
            Resource resource = resourceStore.create(resourceServer, groupName, resourceServer.getClientId());

            // Set resource type
            resource.setType(RESOURCE_TYPE_TENANT);

            // Set scopes
            resource.updateScopes(scopes);

            // Set attributes - include ownerId if this is a child group, and title
            if (parentGroup != null) {
                resource.setAttribute("ownerId", java.util.Collections.singletonList(parentGroup.getName()));
            }

            // Set title attribute on UMA resource for consistency
            if (groupTitle != null && !groupTitle.isEmpty()) {
                resource.setAttribute("title", java.util.Collections.singletonList(groupTitle));
            }

            log.infof("Created UMA resource '%s' with ownerId=%s, title=%s", groupName,
                     parentGroup != null ? parentGroup.getName() : "none", groupTitle);
        } catch (Exception e) {
            log.errorf(e, "Error creating UMA resource for group: %s", groupName);
        }
    }

    @Override
    public void close() {
        // No cleanup needed
    }
}