package com.volaticloud.keycloak.tenant.services;

import com.volaticloud.keycloak.tenant.NotFoundException;
import com.volaticloud.keycloak.tenant.representations.*;
import com.volaticloud.keycloak.tenant.utils.*;
import org.keycloak.models.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for managing resource group operations.
 * Handles fetching, filtering, sorting, and pagination of resource groups.
 */
public class ResourceGroupService {

    private final KeycloakSession session;
    private final GroupNormalizer normalizer;

    public ResourceGroupService(KeycloakSession session) {
        this.session = session;
        this.normalizer = new GroupNormalizer(session);
    }

    /**
     * Gets paginated, searchable list of resource groups under a parent group.
     *
     * @param parentGroupId Parent group ID (e.g., organization)
     * @param search Search term for title (case-insensitive)
     * @param first Page size
     * @param offset Skip N items
     * @param orderBy Sort field (title, totalMembers)
     * @param order Sort direction (asc, desc)
     * @return Paginated list response with normalized resource groups
     */
    public ResourceGroupListResponse getResourceGroups(
        String parentGroupId,
        String search,
        int first,
        int offset,
        String orderBy,
        String order
    ) {
        RealmModel realm = session.getContext().getRealm();

        // 1. Find parent group
        GroupModel parentGroup = findGroup(realm, parentGroupId);
        if (parentGroup == null) {
            throw new NotFoundException("Parent group not found: " + parentGroupId);
        }

        // 2. Get all resource groups (children that are NOT role groups)
        List<ResourceGroupRepresentation> resourceGroups = parentGroup.getSubGroupsStream()
            .filter(g -> !isRoleGroup(g))
            .map(g -> normalizer.normalizeResourceGroup(g))
            .collect(Collectors.toList());

        // 3. Apply search filter
        if (search != null && !search.isEmpty()) {
            String searchLower = search.toLowerCase();
            resourceGroups = resourceGroups.stream()
                .filter(rg -> rg.getTitle().toLowerCase().contains(searchLower))
                .collect(Collectors.toList());
        }

        // 4. Apply sorting
        Comparator<ResourceGroupRepresentation> comparator = getComparator(orderBy, order);
        resourceGroups.sort(comparator);

        // 5. Calculate total and pagination
        int totalCount = resourceGroups.size();
        boolean hasMore = (offset + first) < totalCount;

        // 6. Apply pagination
        List<ResourceGroupRepresentation> page = resourceGroups.stream()
            .skip(offset)
            .limit(first)
            .collect(Collectors.toList());

        return new ResourceGroupListResponse(totalCount, hasMore, page);
    }

    /**
     * Finds a group by ID or path.
     *
     * @param realm Keycloak realm
     * @param groupId Group ID or name
     * @return Group model or null if not found
     */
    private GroupModel findGroup(RealmModel realm, String groupId) {
        // Try by Keycloak internal ID first
        GroupModel group = session.groups().getGroupById(realm, groupId);
        if (group != null) return group;

        // Try by name (UUID) - search all groups since we don't know the parent
        return realm.getGroupsStream()
            .filter(g -> groupId.equals(g.getName()))
            .findFirst()
            .orElse(null);
    }

    /**
     * Checks if a group is a role group (name starts with "role:").
     *
     * @param group Group model
     * @return true if role group
     */
    private boolean isRoleGroup(GroupModel group) {
        return group.getName().startsWith("role:");
    }

    /**
     * Gets comparator for sorting resource groups.
     *
     * @param orderBy Sort field
     * @param order Sort direction
     * @return Comparator
     */
    private Comparator<ResourceGroupRepresentation> getComparator(String orderBy, String order) {
        Comparator<ResourceGroupRepresentation> comparator;

        switch (orderBy) {
            case "totalMembers":
                comparator = Comparator.comparing(ResourceGroupRepresentation::getTotalMembers);
                break;
            case "title":
            default:
                comparator = Comparator.comparing(ResourceGroupRepresentation::getTitle,
                    String.CASE_INSENSITIVE_ORDER);
                break;
        }

        if ("desc".equalsIgnoreCase(order)) {
            comparator = comparator.reversed();
        }

        return comparator;
    }
}