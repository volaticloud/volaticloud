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
import org.keycloak.models.ClientModel;
import org.keycloak.models.GroupModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

import java.util.HashSet;
import java.util.Set;

/**
 * Multi-tenant system event listener that manages hierarchical group structures.
 *
 * Handles the following events:
 * 1. USER creation - Creates tenant group structure for each user
 * 2. AUTHORIZATION_RESOURCE creation - Creates resource groups with owner hierarchy
 * 3. AUTHORIZATION_RESOURCE deletion - Removes groups for tenant resources
 */
@JBossLog
@RequiredArgsConstructor
public class TenantSystemEventListener implements EventListenerProvider {

    private static final String VOLATICLOUD_CLIENT = "volaticloud";
    private static final String ROLE_ADMIN = "role:admin";
    private static final String ROLE_VIEWER = "role:viewer";
    private static final String GROUP_TYPE_ATTRIBUTE = "GROUP_TYPE";
    private static final String GROUP_TITLE_ATTRIBUTE = "GROUP_TITLE";
    private static final String GROUP_TYPE_ORGANIZATION = "organization";
    private static final String GROUP_TYPE_NONE = "none";
    private static final String RESOURCE_TYPE_TENANT = "urn:volaticloud:resources:tenant";

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

                // Handle AUTHORIZATION_RESOURCE creation
                if (event.getResourceType() == ResourceType.AUTHORIZATION_RESOURCE) {
                    handleResourceCreation(event);
                    return;
                }
            }

            // Handle DELETE operations
            if (event.getOperationType() == OperationType.DELETE) {
                // Handle AUTHORIZATION_RESOURCE deletion
                if (event.getResourceType() == ResourceType.AUTHORIZATION_RESOURCE) {
                    handleResourceDeletion(event);
                    return;
                }
            }
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

        // Step 2: Create group structure (same logic as handleResourceCreation)
        createHierarchicalGroupStructure(realm, userId, null, GROUP_TYPE_ORGANIZATION);

        // Step 3: Add user to admin role subgroup
        GroupModel userGroup = session.groups().getGroupByName(realm, null, userId);
        if (userGroup == null) {
            log.errorf("Could not find tenant group for user: %s", userId);
            return;
        }

        // Step 4: Set GROUP_TITLE attribute based on user's name or email
        String organizationTitle = generateOrganizationTitle(user);
        userGroup.setSingleAttribute(GROUP_TITLE_ATTRIBUTE, organizationTitle);
        log.infof("Set GROUP_TITLE=%s for organization group: %s", organizationTitle, userId);

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

            // Get or create scopes (view, edit, manage)
            ScopeStore scopeStore = authz.getStoreFactory().getScopeStore();
            Set<Scope> scopes = new HashSet<>();
            for (String scopeName : new String[]{"view", "edit", "manage"}) {
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
     * Handles authorization resource creation event.
     * Creates hierarchical group structure based on ownerId.
     */
    private void handleResourceCreation(AdminEvent event) {
        String representation = event.getRepresentation();
        if (representation == null) {
            log.warn("No representation found in resource creation event");
            return;
        }

        // Parse the resource name and ownerId from the representation
        String resourceName = extractFieldValue(representation, "name");
        if (resourceName == null || resourceName.isEmpty()) {
            log.warn("Could not extract resource name from event representation");
            return;
        }

        String ownerId = extractOwnerIdFromAttributes(representation);
        String resourceType = extractTypeFromAttributes(representation);

        // If resource doesn't have type attribute, set to "none"
        if (resourceType == null || resourceType.isEmpty()) {
            resourceType = GROUP_TYPE_NONE;
        }

        log.infof("Processing resource: name=%s, ownerId=%s, type=%s", resourceName, ownerId, resourceType);

        // Get the realm
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            log.error("Could not get realm from session context");
            return;
        }

        // Create hierarchical group structure
        createHierarchicalGroupStructure(realm, resourceName, ownerId, resourceType);

        log.infof("Successfully created group structure for resource: %s", resourceName);
    }

    /**
     * Handles authorization resource deletion event.
     * Removes the corresponding group if the resource has type urn:volaticloud:resources:tenant.
     */
    private void handleResourceDeletion(AdminEvent event) {
        String representation = event.getRepresentation();
        if (representation == null) {
            log.warn("No representation found in resource deletion event");
            return;
        }

        // Parse the resource name and type from the representation
        String resourceName = extractFieldValue(representation, "name");
        if (resourceName == null || resourceName.isEmpty()) {
            log.warn("Could not extract resource name from event representation");
            return;
        }

        // Extract resource type from the "type" field (not attribute)
        String resourceType = extractFieldValue(representation, "type");
        log.infof("Processing resource deletion: name=%s, type=%s", resourceName, resourceType);

        // Only delete groups for tenant resources
        if (!RESOURCE_TYPE_TENANT.equals(resourceType)) {
            log.infof("Resource '%s' is not a tenant resource (type=%s), skipping group deletion", resourceName, resourceType);
            return;
        }

        // Get the realm
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            log.error("Could not get realm from session context");
            return;
        }

        // Find and delete the group
        GroupModel group = session.groups().getGroupByName(realm, null, resourceName);
        if (group == null) {
            log.warnf("Group '%s' not found, nothing to delete", resourceName);
            return;
        }

        // Delete the group (this will also delete subgroups)
        boolean removed = session.groups().removeGroup(realm, group);
        if (removed) {
            log.infof("Successfully deleted group '%s' and its subgroups for tenant resource deletion", resourceName);
        } else {
            log.errorf("Failed to delete group '%s'", resourceName);
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
    private void createHierarchicalGroupStructure(RealmModel realm, String resourceName, String ownerId, String resourceType) {
        GroupModel parentGroup = null;

        // If ownerId is provided, get or create parent group
        if (ownerId != null && !ownerId.isEmpty()) {
            // Try to find existing parent group
            parentGroup = session.groups().getGroupByName(realm, null, ownerId);

            if (parentGroup == null) {
                // Parent group doesn't exist - create it with role subgroups
                // Use GROUP_TYPE_NONE for auto-created parent groups (owner resource not yet created)
                log.infof("Parent group '%s' not found, creating it automatically", ownerId);
                parentGroup = createGroupWithRoles(realm, ownerId, null, GROUP_TYPE_NONE);
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
        createGroupWithRoles(realm, resourceName, parentGroup, resourceType);
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
     * Creates a new group with role subgroups and GROUP_TYPE attribute.
     * Returns the created or existing group.
     */
    private GroupModel createGroupWithRoles(RealmModel realm, String groupName, GroupModel parentGroup, String groupType) {
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

            return existingGroup;
        }

        // Create new group
        GroupModel group = session.groups().createGroup(realm, groupName, parentGroup);

        // Set GROUP_TYPE attribute
        group.setSingleAttribute(GROUP_TYPE_ATTRIBUTE, groupType);

        log.infof("Created group: %s under parent: %s with GROUP_TYPE=%s",
                 groupName, parentGroup != null ? parentGroup.getName() : "root", groupType);

        // Create role subgroups
        createRoleSubgroups(realm, group);

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
     * Extracts a field value from JSON representation.
     * Simple JSON parsing without external libraries.
     */
    private String extractFieldValue(String jsonRepresentation, String fieldName) {
        try {
            String searchPattern = "\"" + fieldName + "\"";
            int fieldStart = jsonRepresentation.indexOf(searchPattern);
            if (fieldStart == -1) {
                return null;
            }

            int valueStart = jsonRepresentation.indexOf("\"", fieldStart + searchPattern.length());
            if (valueStart == -1) {
                return null;
            }

            int valueEnd = jsonRepresentation.indexOf("\"", valueStart + 1);
            if (valueEnd == -1) {
                return null;
            }

            return jsonRepresentation.substring(valueStart + 1, valueEnd);
        } catch (Exception e) {
            log.errorf(e, "Error parsing field %s from JSON: %s", fieldName, jsonRepresentation);
            return null;
        }
    }

    /**
     * Extracts ownerId from resource attributes.
     * Example JSON: {"attributes":{"ownerId":["PARENT_RESOURCE"]}}
     */
    private String extractOwnerIdFromAttributes(String jsonRepresentation) {
        try {
            // Look for "attributes" object
            int attributesStart = jsonRepresentation.indexOf("\"attributes\"");
            if (attributesStart == -1) {
                return null;
            }

            // Look for "ownerId" within attributes
            int ownerIdStart = jsonRepresentation.indexOf("\"ownerId\"", attributesStart);
            if (ownerIdStart == -1) {
                return null;
            }

            // ownerId is an array, get first element: ["value"]
            int arrayStart = jsonRepresentation.indexOf("[", ownerIdStart);
            if (arrayStart == -1) {
                return null;
            }

            int valueStart = jsonRepresentation.indexOf("\"", arrayStart);
            if (valueStart == -1) {
                return null;
            }

            int valueEnd = jsonRepresentation.indexOf("\"", valueStart + 1);
            if (valueEnd == -1) {
                return null;
            }

            return jsonRepresentation.substring(valueStart + 1, valueEnd);
        } catch (Exception e) {
            log.errorf(e, "Error parsing ownerId from attributes: %s", jsonRepresentation);
            return null;
        }
    }

    /**
     * Extracts type from resource attributes.
     * Example JSON: {"attributes":{"type":["project"]}}
     */
    private String extractTypeFromAttributes(String jsonRepresentation) {
        try {
            // Look for "attributes" object
            int attributesStart = jsonRepresentation.indexOf("\"attributes\"");
            if (attributesStart == -1) {
                return null;
            }

            // Look for "type" within attributes
            int typeStart = jsonRepresentation.indexOf("\"type\"", attributesStart);
            if (typeStart == -1) {
                return null;
            }

            // type is an array, get first element: ["value"]
            int arrayStart = jsonRepresentation.indexOf("[", typeStart);
            if (arrayStart == -1) {
                return null;
            }

            int valueStart = jsonRepresentation.indexOf("\"", arrayStart);
            if (valueStart == -1) {
                return null;
            }

            int valueEnd = jsonRepresentation.indexOf("\"", valueStart + 1);
            if (valueEnd == -1) {
                return null;
            }

            return jsonRepresentation.substring(valueStart + 1, valueEnd);
        } catch (Exception e) {
            log.errorf(e, "Error parsing type from attributes: %s", jsonRepresentation);
            return null;
        }
    }

    @Override
    public void close() {
        // No cleanup needed
    }
}