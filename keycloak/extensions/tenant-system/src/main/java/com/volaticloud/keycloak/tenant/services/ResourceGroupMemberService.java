package com.volaticloud.keycloak.tenant.services;

import com.volaticloud.keycloak.tenant.NotFoundException;
import com.volaticloud.keycloak.tenant.representations.*;
import com.volaticloud.keycloak.tenant.utils.*;
import org.keycloak.models.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for managing resource group member operations.
 * Handles fetching, filtering, sorting, and pagination of members with role information.
 */
public class ResourceGroupMemberService {

    private final KeycloakSession session;
    private final RolePriorityUtils rolePriority;

    public ResourceGroupMemberService(KeycloakSession session) {
        this.session = session;
        this.rolePriority = new RolePriorityUtils();
    }

    /**
     * Gets paginated, searchable list of resource group members with role information.
     *
     * @param parentGroupId Parent group ID (for validation)
     * @param resourceGroupId Resource group ID
     * @param roleFilter Array of roles to filter by (null = all roles)
     * @param search Search term for username, email, firstName, lastName
     * @param enabled Filter by user enabled status
     * @param emailVerified Filter by email verified status
     * @param first Page size
     * @param offset Skip N items
     * @param orderBy Sort field
     * @param order Sort direction
     * @return Paginated list response with member representations
     */
    public ResourceGroupMemberListResponse getMembers(
        String parentGroupId,
        String resourceGroupId,
        String[] roleFilter,
        String search,
        Boolean enabled,
        Boolean emailVerified,
        int first,
        int offset,
        String orderBy,
        String order
    ) {
        RealmModel realm = session.getContext().getRealm();

        // 1. Find resource group
        GroupModel resourceGroup = findGroup(realm, resourceGroupId);
        if (resourceGroup == null) {
            throw new NotFoundException("Resource group not found: " + resourceGroupId);
        }

        // 2. Fetch members by role
        Map<String, UserModel> userMap = new HashMap<>(); // userId -> User (deduplicate)
        Map<String, Set<String>> userRoles = new HashMap<>(); // userId -> Set of roles

        List<GroupModel> roleGroups = resourceGroup.getSubGroupsStream()
            .filter(g -> g.getName().startsWith("role:"))
            .collect(Collectors.toList());

        // Extract all available roles (before filtering)
        List<String> availableRoles = roleGroups.stream()
            .map(g -> extractRoleName(g.getName()))
            .sorted()
            .collect(Collectors.toList());

        for (GroupModel roleGroup : roleGroups) {
            String roleName = extractRoleName(roleGroup.getName()); // "role:admin" -> "admin"

            // Apply role filter
            if (roleFilter != null && roleFilter.length > 0) {
                if (!Arrays.asList(roleFilter).contains(roleName)) {
                    continue; // Skip this role
                }
            }

            // Fetch members
            session.users().getGroupMembersStream(realm, roleGroup).forEach(user -> {
                userMap.put(user.getId(), user);
                userRoles.computeIfAbsent(user.getId(), k -> new HashSet<>()).add(roleName);
            });
        }

        // 3. Build member representations
        List<ResourceGroupMemberRepresentation> members = userMap.values().stream()
            .map(user -> buildMemberRepresentation(user, userRoles.get(user.getId())))
            .collect(Collectors.toList());

        // 4. Apply filters
        members = applyFilters(members, search, enabled, emailVerified);

        // 5. Apply sorting
        Comparator<ResourceGroupMemberRepresentation> comparator = getComparator(orderBy, order);
        members.sort(comparator);

        // 6. Calculate pagination
        int totalCount = members.size();
        boolean hasMore = (offset + first) < totalCount;

        // 7. Apply pagination
        List<ResourceGroupMemberRepresentation> page = members.stream()
            .skip(offset)
            .limit(first)
            .collect(Collectors.toList());

        return new ResourceGroupMemberListResponse(totalCount, hasMore, page, availableRoles);
    }

    /**
     * Builds a member representation with user data, roles, and primary role.
     *
     * @param user User model
     * @param roles Set of role names the user belongs to
     * @return Member representation
     */
    private ResourceGroupMemberRepresentation buildMemberRepresentation(
        UserModel user,
        Set<String> roles
    ) {
        MemberUser memberUser = new MemberUser();
        memberUser.setId(user.getId());
        memberUser.setUsername(user.getUsername());
        memberUser.setEmail(user.getEmail());
        memberUser.setEmailVerified(user.isEmailVerified());
        memberUser.setFirstName(user.getFirstName());
        memberUser.setLastName(user.getLastName());
        memberUser.setEnabled(user.isEnabled());
        memberUser.setCreatedTimestamp(user.getCreatedTimestamp());

        List<String> roleList = new ArrayList<>(roles);
        String primaryRole = rolePriority.determinePrimaryRole(roleList);

        return new ResourceGroupMemberRepresentation(memberUser, roleList, primaryRole);
    }

    /**
     * Applies search and boolean filters to member list.
     *
     * @param members List of members
     * @param search Search term
     * @param enabled Enabled filter
     * @param emailVerified Email verified filter
     * @return Filtered list
     */
    private List<ResourceGroupMemberRepresentation> applyFilters(
        List<ResourceGroupMemberRepresentation> members,
        String search,
        Boolean enabled,
        Boolean emailVerified
    ) {
        return members.stream()
            .filter(m -> {
                MemberUser user = m.getUser();

                // Search filter (case-insensitive, multiple fields)
                if (search != null && !search.isEmpty()) {
                    String searchLower = search.toLowerCase();
                    boolean matches = false;

                    if (user.getUsername() != null && user.getUsername().toLowerCase().contains(searchLower)) {
                        matches = true;
                    }
                    if (user.getEmail() != null && user.getEmail().toLowerCase().contains(searchLower)) {
                        matches = true;
                    }
                    if (user.getFirstName() != null && user.getFirstName().toLowerCase().contains(searchLower)) {
                        matches = true;
                    }
                    if (user.getLastName() != null && user.getLastName().toLowerCase().contains(searchLower)) {
                        matches = true;
                    }

                    if (!matches) {
                        return false;
                    }
                }

                // Enabled filter
                if (enabled != null && !enabled.equals(user.getEnabled())) {
                    return false;
                }

                // Email verified filter
                if (emailVerified != null && !emailVerified.equals(user.getEmailVerified())) {
                    return false;
                }

                return true;
            })
            .collect(Collectors.toList());
    }

    /**
     * Gets comparator for sorting members.
     *
     * @param orderBy Sort field
     * @param order Sort direction
     * @return Comparator
     */
    private Comparator<ResourceGroupMemberRepresentation> getComparator(String orderBy, String order) {
        Comparator<ResourceGroupMemberRepresentation> comparator;

        switch (orderBy) {
            case "email":
                comparator = Comparator.comparing(
                    m -> m.getUser().getEmail(),
                    Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                );
                break;
            case "firstName":
                comparator = Comparator.comparing(
                    m -> m.getUser().getFirstName(),
                    Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                );
                break;
            case "lastName":
                comparator = Comparator.comparing(
                    m -> m.getUser().getLastName(),
                    Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                );
                break;
            case "createdAt":
                comparator = Comparator.comparing(
                    m -> m.getUser().getCreatedTimestamp(),
                    Comparator.nullsLast(Long::compareTo)
                );
                break;
            case "primaryRole":
                comparator = Comparator.comparing(ResourceGroupMemberRepresentation::getPrimaryRole);
                break;
            case "username":
            default:
                comparator = Comparator.comparing(
                    m -> m.getUser().getUsername(),
                    Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                );
                break;
        }

        if ("desc".equalsIgnoreCase(order)) {
            comparator = comparator.reversed();
        }

        return comparator;
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
     * Extracts role name from group name.
     *
     * @param groupName Group name (e.g., "role:admin")
     * @return Role name (e.g., "admin")
     */
    private String extractRoleName(String groupName) {
        return groupName.startsWith("role:") ? groupName.substring(5) : groupName;
    }
}