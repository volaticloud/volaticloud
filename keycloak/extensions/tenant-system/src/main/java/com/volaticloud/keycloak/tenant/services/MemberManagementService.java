package com.volaticloud.keycloak.tenant.services;

import com.volaticloud.keycloak.tenant.NotFoundException;
import com.volaticloud.keycloak.tenant.representations.MemberResponse;
import lombok.extern.jbosslog.JBossLog;
import org.keycloak.models.*;
import org.keycloak.organization.OrganizationProvider;

/**
 * Service for unified member management across resources and native Keycloak Organizations.
 *
 * <p>Provides operations to add/remove users from resources with custom role support.
 * When the resource type is "organization", member operations are also synced with
 * the native Keycloak Organization.
 *
 * <p><strong>Role Structure:</strong> Roles are stored as subgroups with "role:" prefix.
 * For example, role "admin" is stored as subgroup "role:admin" under the resource group.
 * Custom roles are created on-demand when adding members.
 */
@JBossLog
public class MemberManagementService {

    private static final String GROUP_TYPE_ATTRIBUTE = "GROUP_TYPE";
    private static final String RESOURCE_TYPE_ORGANIZATION = "organization";
    private static final String ROLE_PREFIX = "role:";

    private final KeycloakSession session;

    public MemberManagementService(KeycloakSession session) {
        this.session = session;
    }

    /**
     * Adds a user to a resource with the specified role.
     * For organization-type resources, also adds to native Keycloak Organization.
     *
     * @param resourceId Resource ID (UUID)
     * @param userId User ID (UUID)
     * @param role Role name (e.g., "admin", "viewer", "editor")
     * @return MemberResponse with operation result
     * @throws NotFoundException if user or resource not found
     * @throws Exception if operation fails
     */
    public MemberResponse addMember(String resourceId, String userId, String role) throws Exception {
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            throw new Exception("Could not get realm from session context");
        }

        // 1. Find user
        UserModel user = session.users().getUserById(realm, userId);
        if (user == null) {
            throw new NotFoundException("User not found: " + userId);
        }

        // 2. Find resource group
        GroupModel resourceGroup = findResourceGroup(realm, resourceId);
        if (resourceGroup == null) {
            throw new NotFoundException("Resource not found: " + resourceId);
        }

        // 3. Find or create role subgroup
        String roleGroupName = ROLE_PREFIX + role;
        GroupModel roleGroup = findOrCreateRoleGroup(realm, resourceGroup, roleGroupName);

        // 4. Add user to role group
        user.joinGroup(roleGroup);
        log.infof("Added user %s to role %s in resource %s", userId, role, resourceId);

        // 5. If organization type, also add to native Keycloak Organization
        boolean addedToOrg = false;
        String groupType = resourceGroup.getFirstAttribute(GROUP_TYPE_ATTRIBUTE);
        if (RESOURCE_TYPE_ORGANIZATION.equals(groupType)) {
            addedToOrg = addToNativeOrganization(resourceId, user);
        }

        return new MemberResponse(userId, resourceId, role, addedToOrg);
    }

    /**
     * Removes a user from a resource (all roles).
     * For organization-type resources, also removes from native Keycloak Organization.
     *
     * @param resourceId Resource ID (UUID)
     * @param userId User ID (UUID)
     * @throws NotFoundException if user or resource not found
     * @throws Exception if operation fails
     */
    public void removeMember(String resourceId, String userId) throws Exception {
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            throw new Exception("Could not get realm from session context");
        }

        // 1. Find user
        UserModel user = session.users().getUserById(realm, userId);
        if (user == null) {
            throw new NotFoundException("User not found: " + userId);
        }

        // 2. Find resource group
        GroupModel resourceGroup = findResourceGroup(realm, resourceId);
        if (resourceGroup == null) {
            throw new NotFoundException("Resource not found: " + resourceId);
        }

        // 3. Remove user from all role subgroups
        resourceGroup.getSubGroupsStream()
            .filter(g -> g.getName().startsWith(ROLE_PREFIX))
            .forEach(roleGroup -> {
                user.leaveGroup(roleGroup);
                log.infof("Removed user %s from role group %s", userId, roleGroup.getName());
            });

        // 4. If organization type, also remove from native Keycloak Organization
        String groupType = resourceGroup.getFirstAttribute(GROUP_TYPE_ATTRIBUTE);
        if (RESOURCE_TYPE_ORGANIZATION.equals(groupType)) {
            removeFromNativeOrganization(resourceId, user);
        }

        log.infof("Removed user %s from all roles in resource %s", userId, resourceId);
    }

    /**
     * Removes a user from a specific role in a resource.
     * If this is the user's last role in an organization-type resource,
     * also removes from native Keycloak Organization.
     *
     * @param resourceId Resource ID (UUID)
     * @param userId User ID (UUID)
     * @param role Role name to remove
     * @throws NotFoundException if user or resource not found
     * @throws Exception if operation fails
     */
    public void removeMemberRole(String resourceId, String userId, String role) throws Exception {
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            throw new Exception("Could not get realm from session context");
        }

        UserModel user = session.users().getUserById(realm, userId);
        if (user == null) {
            throw new NotFoundException("User not found: " + userId);
        }

        GroupModel resourceGroup = findResourceGroup(realm, resourceId);
        if (resourceGroup == null) {
            throw new NotFoundException("Resource not found: " + resourceId);
        }

        String roleGroupName = ROLE_PREFIX + role;
        GroupModel roleGroup = session.groups().getGroupByName(realm, resourceGroup, roleGroupName);
        if (roleGroup != null) {
            user.leaveGroup(roleGroup);
            log.infof("Removed user %s from role %s in resource %s", userId, role, resourceId);
        }

        // Check if user has any remaining roles in this resource
        boolean hasOtherRoles = resourceGroup.getSubGroupsStream()
            .filter(g -> g.getName().startsWith(ROLE_PREFIX))
            .anyMatch(g -> session.users().getGroupMembersStream(realm, g)
                .anyMatch(u -> u.getId().equals(userId)));

        // If no other roles and this is an organization, remove from native org
        if (!hasOtherRoles) {
            String groupType = resourceGroup.getFirstAttribute(GROUP_TYPE_ATTRIBUTE);
            if (RESOURCE_TYPE_ORGANIZATION.equals(groupType)) {
                removeFromNativeOrganization(resourceId, user);
            }
        }
    }

    /**
     * Finds a resource group by ID (searches globally across all hierarchies).
     */
    private GroupModel findResourceGroup(RealmModel realm, String resourceId) {
        return session.groups()
            .searchForGroupByNameStream(realm, resourceId, true, 0, 1)
            .findFirst()
            .orElse(null);
    }

    /**
     * Finds or creates a role subgroup under the parent resource group.
     */
    private GroupModel findOrCreateRoleGroup(RealmModel realm, GroupModel parent, String roleName) {
        GroupModel roleGroup = session.groups().getGroupByName(realm, parent, roleName);
        if (roleGroup == null) {
            roleGroup = session.groups().createGroup(realm, roleName, parent);
            log.infof("Created new role group: %s under %s", roleName, parent.getName());
        }
        return roleGroup;
    }

    /**
     * Adds a user to a native Keycloak Organization.
     * Best-effort operation - logs warnings on failure but doesn't throw exceptions.
     *
     * @param orgAlias Organization alias (resource ID)
     * @param user User to add
     * @return true if user was added, false otherwise
     */
    private boolean addToNativeOrganization(String orgAlias, UserModel user) {
        OrganizationProvider orgProvider = session.getProvider(OrganizationProvider.class);
        if (orgProvider == null) {
            log.warnf("OrganizationProvider not available, skipping organization membership for: %s", orgAlias);
            return false;
        }

        OrganizationModel org = orgProvider.getByAlias(orgAlias);
        if (org == null) {
            log.warnf("Native organization not found by alias: %s", orgAlias);
            return false;
        }

        boolean added = orgProvider.addMember(org, user);
        if (added) {
            log.infof("Added user %s to native organization %s", user.getId(), orgAlias);
        } else {
            log.infof("User %s already a member of native organization %s", user.getId(), orgAlias);
        }
        return added;
    }

    /**
     * Removes a user from a native Keycloak Organization.
     * Best-effort operation - logs warnings on failure but doesn't throw exceptions.
     *
     * @param orgAlias Organization alias (resource ID)
     * @param user User to remove
     */
    private void removeFromNativeOrganization(String orgAlias, UserModel user) {
        OrganizationProvider orgProvider = session.getProvider(OrganizationProvider.class);
        if (orgProvider == null) {
            log.warnf("OrganizationProvider not available, skipping organization membership removal for: %s", orgAlias);
            return;
        }

        OrganizationModel org = orgProvider.getByAlias(orgAlias);
        if (org == null) {
            log.warnf("Native organization not found by alias: %s", orgAlias);
            return;
        }

        boolean removed = orgProvider.removeMember(org, user);
        if (removed) {
            log.infof("Removed user %s from native organization %s", user.getId(), orgAlias);
        } else {
            log.warnf("Failed to remove user %s from native organization %s (may not have been a member)", user.getId(), orgAlias);
        }
    }
}