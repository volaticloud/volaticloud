package com.volaticloud.keycloak.tenant.utils;

import com.volaticloud.keycloak.tenant.representations.*;
import org.keycloak.models.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Normalizes Keycloak group structure to business-friendly format.
 *
 * Transforms:
 * - Resource Group → ResourceGroupRepresentation with roles array
 * - role:* subgroups → RoleInfo objects (strips "role:" prefix)
 * - GROUP_TITLE attribute → title field
 */
public class GroupNormalizer {

    private final KeycloakSession session;

    public GroupNormalizer(KeycloakSession session) {
        this.session = session;
    }

    /**
     * Normalizes a resource group by extracting role subgroups and attributes.
     *
     * @param resourceGroup Keycloak group model
     * @return Normalized representation with roles as property
     */
    public ResourceGroupRepresentation normalizeResourceGroup(GroupModel resourceGroup) {
        String name = resourceGroup.getName();
        String path = buildPath(resourceGroup);

        // Extract title from GROUP_TITLE attribute
        String title = resourceGroup.getFirstAttribute("GROUP_TITLE");
        if (title == null || title.isEmpty()) {
            title = name; // Fallback to name
        }

        // Fetch role subgroups and normalize
        List<RoleInfoRepresentation> roles = resourceGroup.getSubGroupsStream()
            .filter(g -> g.getName().startsWith("role:"))
            .map(this::normalizeRoleInfo)
            .collect(Collectors.toList());

        // Calculate total members
        int totalMembers = roles.stream()
            .mapToInt(RoleInfoRepresentation::getMemberCount)
            .sum();

        // Check if group has children (non-role subgroups)
        boolean hasChildren = resourceGroup.getSubGroupsStream()
            .anyMatch(g -> !g.getName().startsWith("role:"));

        return new ResourceGroupRepresentation(name, path, title, roles, totalMembers, hasChildren);
    }

    /**
     * Normalizes a role subgroup to extract role name and member count.
     *
     * @param roleGroup Role subgroup (name starts with "role:")
     * @return Role info with normalized name (without "role:" prefix)
     */
    private RoleInfoRepresentation normalizeRoleInfo(GroupModel roleGroup) {
        RealmModel realm = session.getContext().getRealm();
        String roleName = extractRoleName(roleGroup.getName());
        long memberCount = session.users().getGroupMembersStream(realm, roleGroup).count();

        return new RoleInfoRepresentation(roleName, (int) memberCount);
    }

    /**
     * Builds group path by traversing parent hierarchy.
     *
     * @param group Group model
     * @return Group path (e.g., "/parent/child")
     */
    private String buildPath(GroupModel group) {
        if (group.getParent() == null) {
            return "/" + group.getName();
        }
        return buildPath(group.getParent()) + "/" + group.getName();
    }

    /**
     * Extracts role name from group name by removing "role:" prefix.
     *
     * @param groupName Group name (e.g., "role:admin")
     * @return Role name (e.g., "admin")
     */
    private String extractRoleName(String groupName) {
        return groupName.startsWith("role:") ? groupName.substring(5) : groupName;
    }
}