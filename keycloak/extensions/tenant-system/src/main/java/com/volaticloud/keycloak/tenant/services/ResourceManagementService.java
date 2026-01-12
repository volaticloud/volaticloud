package com.volaticloud.keycloak.tenant.services;

import com.volaticloud.keycloak.tenant.NotFoundException;
import com.volaticloud.keycloak.tenant.representations.*;
import lombok.extern.jbosslog.JBossLog;
import org.keycloak.authorization.AuthorizationProvider;
import org.keycloak.authorization.model.Resource;
import org.keycloak.authorization.model.ResourceServer;
import org.keycloak.authorization.model.Scope;
import org.keycloak.authorization.store.ResourceStore;
import org.keycloak.authorization.store.ScopeStore;
import org.keycloak.models.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for unified resource management (UMA resource + Keycloak group).
 *
 * Provides atomic operations that manage both UMA resources (for authorization)
 * and Keycloak groups (for organizational hierarchy) together.
 */
@JBossLog
public class ResourceManagementService {

    private static final String VOLATICLOUD_CLIENT = "volaticloud";
    private static final String RESOURCE_TYPE_TENANT = "urn:volaticloud:resources:tenant";
    private static final String GROUP_TYPE_ATTRIBUTE = "GROUP_TYPE";
    private static final String GROUP_TITLE_ATTRIBUTE = "GROUP_TITLE";
    private static final String ROLE_ADMIN = "role:admin";
    private static final String ROLE_VIEWER = "role:viewer";

    private final KeycloakSession session;

    public ResourceManagementService(KeycloakSession session) {
        this.session = session;
    }

    /**
     * Creates a unified resource (UMA resource + Keycloak group) atomically.
     *
     * @param request Resource creation request
     * @return ResourceResponse with created resource details
     * @throws Exception if creation fails
     */
    public ResourceResponse createResource(ResourceCreateRequest request) throws Exception {
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            throw new Exception("Could not get realm from session context");
        }

        // Validate request
        if (request.getId() == null || request.getId().isEmpty()) {
            throw new IllegalArgumentException("Resource ID is required");
        }
        if (request.getTitle() == null || request.getTitle().isEmpty()) {
            throw new IllegalArgumentException("Resource title is required");
        }
        if (request.getType() == null || request.getType().isEmpty()) {
            throw new IllegalArgumentException("Resource type is required");
        }

        // Step 1: Check if resource already exists
        Resource existingResource = findResourceByName(realm, request.getId());
        if (existingResource != null) {
            throw new IllegalStateException("Resource already exists: " + request.getId());
        }

        // Step 2: Get parent group if ownerId is provided (search globally with exact match)
        GroupModel parentGroup = null;
        if (request.getOwnerId() != null && !request.getOwnerId().isEmpty()) {
            parentGroup = session.groups()
                .searchForGroupByNameStream(realm, request.getOwnerId(), true, 0, 1)
                .findFirst()
                .orElse(null);
            if (parentGroup == null) {
                throw new NotFoundException("Parent resource not found: " + request.getOwnerId());
            }
        }

        // Step 3: Create Keycloak group with role subgroups
        GroupModel group = createGroupWithRoles(realm, request.getId(), parentGroup, request.getType(), request.getTitle());

        // Step 4: Create UMA resource
        Resource resource = createUMAResource(realm, request, parentGroup);

        // Step 5: Build response
        return buildResourceResponse(resource, group, parentGroup);
    }

    /**
     * Updates a unified resource (UMA resource + Keycloak group) atomically.
     *
     * @param resourceId Resource ID to update
     * @param request Update request with fields to change
     * @return ResourceResponse with updated resource details
     * @throws Exception if update fails
     */
    public ResourceResponse updateResource(String resourceId, ResourceUpdateRequest request) throws Exception {
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            throw new Exception("Could not get realm from session context");
        }

        // Step 1: Find UMA resource
        Resource resource = findResourceByName(realm, resourceId);
        if (resource == null) {
            throw new NotFoundException("Resource not found: " + resourceId);
        }

        // Step 2: Find Keycloak group (search globally with exact match)
        GroupModel group = session.groups()
            .searchForGroupByNameStream(realm, resourceId, true, 0, 1)
            .findFirst()
            .orElse(null);
        if (group == null) {
            throw new NotFoundException("Group not found: " + resourceId);
        }

        // Step 3: Update group attributes if title changed
        if (request.getTitle() != null && !request.getTitle().isEmpty()) {
            group.setSingleAttribute(GROUP_TITLE_ATTRIBUTE, request.getTitle());
            log.infof("Updated GROUP_TITLE for resource %s to: %s", resourceId, request.getTitle());
        }

        // Step 4: Update UMA resource attributes AND sync to group if provided
        if (request.getAttributes() != null && !request.getAttributes().isEmpty()) {
            for (Map.Entry<String, List<String>> entry : request.getAttributes().entrySet()) {
                String attrKey = entry.getKey();
                List<String> attrValue = entry.getValue();

                // Update UMA resource attribute
                resource.setAttribute(attrKey, attrValue);

                // Sync specific attributes to group
                // "type" attribute in UMA should sync to GROUP_TYPE in group
                if (attrKey.equals("type") && attrValue != null && !attrValue.isEmpty()) {
                    group.setSingleAttribute(GROUP_TYPE_ATTRIBUTE, attrValue.get(0));
                    log.infof("Updated GROUP_TYPE for resource %s to: %s", resourceId, attrValue.get(0));
                }
                // Other custom attributes (like "public", "exchangeType", etc.) are also synced to group
                else {
                    group.setAttribute(attrKey, attrValue);
                    log.infof("Synced attribute %s to group for resource %s", attrKey, resourceId);
                }
            }
            log.infof("Updated UMA resource and synced attributes to group for: %s", resourceId);
        }

        // If title was updated, also update it in UMA resource attributes and displayName
        if (request.getTitle() != null && !request.getTitle().isEmpty()) {
            resource.setAttribute("title", Collections.singletonList(request.getTitle()));
            resource.setDisplayName(request.getTitle());
            log.infof("Updated UMA resource displayName for: %s to: %s", resourceId, request.getTitle());
        }

        // Step 5: Determine parent group for response
        GroupModel parentGroup = group.getParent();

        // Step 6: Build response
        return buildResourceResponse(resource, group, parentGroup);
    }

    /**
     * Deletes a unified resource (UMA resource + Keycloak group) atomically.
     *
     * @param resourceId Resource ID to delete
     * @throws Exception if deletion fails
     */
    public void deleteResource(String resourceId) throws Exception {
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            throw new Exception("Could not get realm from session context");
        }

        // Step 1: Find and delete UMA resource
        Resource resource = findResourceByName(realm, resourceId);
        if (resource != null) {
            AuthorizationProvider authz = session.getProvider(AuthorizationProvider.class);
            ResourceStore resourceStore = authz.getStoreFactory().getResourceStore();
            resourceStore.delete(resource.getId());
            log.infof("Deleted UMA resource: %s", resourceId);
        } else {
            log.warnf("UMA resource not found: %s", resourceId);
        }

        // Step 2: Find and delete Keycloak group (search globally with exact match)
        GroupModel group = session.groups()
            .searchForGroupByNameStream(realm, resourceId, true, 0, 1)
            .findFirst()
            .orElse(null);
        if (group != null) {
            boolean removed = session.groups().removeGroup(realm, group);
            if (removed) {
                log.infof("Deleted Keycloak group and subgroups: %s", resourceId);
            } else {
                throw new Exception("Failed to delete group: " + resourceId);
            }
        } else {
            log.warnf("Keycloak group not found: %s", resourceId);
        }
    }

    /**
     * Gets resource details.
     *
     * @param resourceId Resource ID
     * @return ResourceResponse with resource details
     * @throws Exception if resource not found
     */
    public ResourceResponse getResource(String resourceId) throws Exception {
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            throw new Exception("Could not get realm from session context");
        }

        // Find UMA resource
        Resource resource = findResourceByName(realm, resourceId);
        if (resource == null) {
            throw new NotFoundException("Resource not found: " + resourceId);
        }

        // Find Keycloak group (search globally with exact match)
        GroupModel group = session.groups()
            .searchForGroupByNameStream(realm, resourceId, true, 0, 1)
            .findFirst()
            .orElse(null);
        if (group == null) {
            throw new NotFoundException("Group not found: " + resourceId);
        }

        // Get parent group
        GroupModel parentGroup = group.getParent();

        // Build response
        return buildResourceResponse(resource, group, parentGroup);
    }

    /**
     * Creates a Keycloak group with role subgroups.
     */
    private GroupModel createGroupWithRoles(RealmModel realm, String groupName, GroupModel parentGroup, String groupType, String groupTitle) {
        // Create main group
        GroupModel group = session.groups().createGroup(realm, groupName, parentGroup);

        // Set GROUP_TYPE attribute
        group.setSingleAttribute(GROUP_TYPE_ATTRIBUTE, groupType);

        // Set GROUP_TITLE attribute
        group.setSingleAttribute(GROUP_TITLE_ATTRIBUTE, groupTitle);

        log.infof("Created group: %s under parent: %s with GROUP_TYPE=%s, GROUP_TITLE=%s",
                 groupName, parentGroup != null ? parentGroup.getName() : "root", groupType, groupTitle);

        // Create role subgroups
        session.groups().createGroup(realm, ROLE_ADMIN, group);
        log.infof("Created subgroup: %s under %s", ROLE_ADMIN, groupName);

        session.groups().createGroup(realm, ROLE_VIEWER, group);
        log.infof("Created subgroup: %s under %s", ROLE_VIEWER, groupName);

        return group;
    }

    /**
     * Creates a UMA resource for the given request.
     */
    private Resource createUMAResource(RealmModel realm, ResourceCreateRequest request, GroupModel parentGroup) throws Exception {
        ClientModel client = realm.getClientByClientId(VOLATICLOUD_CLIENT);
        if (client == null) {
            throw new Exception("Client '" + VOLATICLOUD_CLIENT + "' not found");
        }

        AuthorizationProvider authz = session.getProvider(AuthorizationProvider.class);
        ResourceServer resourceServer = authz.getStoreFactory().getResourceServerStore().findByClient(client);
        if (resourceServer == null) {
            throw new Exception("Resource server not found for client '" + VOLATICLOUD_CLIENT + "'");
        }

        ResourceStore resourceStore = authz.getStoreFactory().getResourceStore();
        ScopeStore scopeStore = authz.getStoreFactory().getScopeStore();

        // Get or create scopes
        Set<Scope> scopes = new HashSet<>();
        if (request.getScopes() != null) {
            for (String scopeName : request.getScopes()) {
                Scope scope = scopeStore.findByName(resourceServer, scopeName);
                if (scope == null) {
                    scope = scopeStore.create(resourceServer, scopeName);
                    log.infof("Created scope: %s", scopeName);
                }
                scopes.add(scope);
            }
        }

        // Create resource
        Resource resource = resourceStore.create(resourceServer, request.getId(), resourceServer.getClientId());

        // Set resource type
        resource.setType(RESOURCE_TYPE_TENANT);

        // Set scopes
        resource.updateScopes(scopes);

        // Set attributes
        if (request.getAttributes() != null) {
            for (Map.Entry<String, List<String>> entry : request.getAttributes().entrySet()) {
                resource.setAttribute(entry.getKey(), entry.getValue());
            }
        }

        // Set ownerId if parent exists
        if (parentGroup != null) {
            resource.setAttribute("ownerId", Collections.singletonList(parentGroup.getName()));
        }

        // Set type attribute
        resource.setAttribute("type", Collections.singletonList(request.getType()));

        // Set title attribute
        resource.setAttribute("title", Collections.singletonList(request.getTitle()));

        // Set display name (this is what shows in Keycloak UI)
        resource.setDisplayName(request.getTitle());

        log.infof("Created UMA resource: %s with type=%s, title=%s", request.getId(), request.getType(), request.getTitle());

        return resource;
    }

    /**
     * Finds a UMA resource by name.
     */
    private Resource findResourceByName(RealmModel realm, String resourceName) {
        try {
            ClientModel client = realm.getClientByClientId(VOLATICLOUD_CLIENT);
            if (client == null) {
                return null;
            }

            AuthorizationProvider authz = session.getProvider(AuthorizationProvider.class);
            ResourceServer resourceServer = authz.getStoreFactory().getResourceServerStore().findByClient(client);
            if (resourceServer == null) {
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
     * Builds a ResourceResponse from UMA resource and Keycloak group.
     */
    private ResourceResponse buildResourceResponse(Resource resource, GroupModel group, GroupModel parentGroup) {
        // Extract attributes from resource
        Map<String, List<String>> attributes = resource.getAttributes();

        // Extract type from GROUP_TYPE attribute
        String type = group.getFirstAttribute(GROUP_TYPE_ATTRIBUTE);

        // Extract title from GROUP_TITLE attribute
        String title = group.getFirstAttribute(GROUP_TITLE_ATTRIBUTE);

        // Extract ownerId
        String ownerId = null;
        if (parentGroup != null) {
            ownerId = parentGroup.getName();
        }

        // Extract scopes
        List<String> scopes = resource.getScopes().stream()
            .map(Scope::getName)
            .collect(Collectors.toList());

        return new ResourceResponse(
            resource.getName(),           // id
            title,                        // title
            type,                         // type
            ownerId,                      // ownerId
            group.getId(),                // groupId
            resource.getId(),             // umaResourceId
            scopes,                       // scopes
            attributes                    // attributes
        );
    }
}