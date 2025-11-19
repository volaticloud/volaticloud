package com.volaticloud.keycloak;

import org.jboss.logging.Logger;
import org.keycloak.authorization.policy.evaluation.Evaluation;
import org.keycloak.authorization.policy.evaluation.EvaluationContext;
import org.keycloak.authorization.policy.provider.PolicyProvider;
import org.keycloak.models.GroupModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class GroupResourcePolicyProvider implements PolicyProvider {

    private static final Logger logger = Logger.getLogger(GroupResourcePolicyProvider.class);

    public GroupResourcePolicyProvider() {
    }

    @Override
    public void evaluate(Evaluation evaluation) {
        EvaluationContext context = evaluation.getContext();
        String userId = context.getIdentity().getId();

        // Try to get groupId first, then fallback to groupAlias
        String groupId = getResourceAttribute(evaluation, "groupId");
        String groupAlias = getResourceAttribute(evaluation, "groupAlias");

        if ((groupId == null || groupId.isEmpty()) && (groupAlias == null || groupAlias.isEmpty())) {
            logger.debugf("No groupId or groupAlias found in resource attributes for policy %s", evaluation.getPolicy().getName());
            return; // Deny access if neither groupId nor groupAlias is specified
        }

        KeycloakSession session = evaluation.getAuthorizationProvider().getKeycloakSession();
        RealmModel realm = session.getContext().getRealm();
        UserModel user = session.users().getUserById(realm, userId);

        GroupModel group = null;
        String groupIdentifier = null;

        // Try to find a group by ID first, then by alias
        if (groupId != null && !groupId.isEmpty()) {
            group = session.groups().getGroupById(realm, groupId);
            groupIdentifier = "groupId: " + groupId;
        } else if (groupAlias != null && !groupAlias.isEmpty()) {
            group = findGroupByAlias(session, realm, groupAlias);
            groupIdentifier = "groupAlias: " + groupAlias;
        }

        if (user != null && group != null) {
            // Extract roles from policy configuration
            Set<String> requiredRoles = extractRolesFromPolicy(evaluation);

            boolean hasAccess = false;
            if (requiredRoles != null && !requiredRoles.isEmpty()) {
                // Role-based access check
                hasAccess = checkRoleBasedMembership(user, group, requiredRoles);
                logger.debugf("Role-based access check for user %s in group %s with roles %s: %s",
                    userId, groupIdentifier, requiredRoles, hasAccess);
            } else {
                // Simple group membership check (backward compatibility)
                hasAccess = user.isMemberOf(group);
                logger.debugf("Simple group membership check for user %s in group %s: %s",
                    userId, groupIdentifier, hasAccess);
            }

            if (hasAccess) {
                evaluation.grant();
            }
        }

        logger.debugf("User policy %s evaluated to status %s on identity %s for %s",
            evaluation.getPolicy().getName(), evaluation.getEffect(), userId, groupIdentifier);
    }

    private String getResourceAttribute(Evaluation evaluation, String attributeName) {
        var attributes = evaluation.getPermission().getResource().getAttributes().get(attributeName);
        return attributes != null && !attributes.isEmpty() ? attributes.get(0) : null;
    }

    private GroupModel findGroupByAlias(KeycloakSession session, RealmModel realm, String alias) {
        return session.groups().getGroupsStream(realm)
                .filter(group -> alias.equals(group.getName()))
                .findFirst()
                .orElse(null);
    }

    private Set<String> extractRolesFromPolicy(Evaluation evaluation) {
        try {
            var config = evaluation.getPolicy().getConfig();
            if (config != null && !config.isEmpty()) {
                // First try to get roles from config (for backward compatibility)
                String rolesConfig = config.get("roles");
                if (rolesConfig != null && !rolesConfig.isEmpty()) {
                    return new HashSet<>(Arrays.asList(rolesConfig.split(",")));
                }

                // If no roles in config, try to extract from description
                String description = config.get("description");
                if (description != null && !description.isEmpty()) {
                    return extractRolesFromDescription(description);
                }
            }
        } catch (Exception e) {
            logger.warnf("Failed to extract roles from policy configuration: %s", e.getMessage());
        }
        return null;
    }

    private Set<String> extractRolesFromDescription(String description) {
        try {
            // Look for pattern: "roles: admin,viewer" or "Roles: admin,viewer"
            String[] lines = description.split("\\n");
            for (String line : lines) {
                String trimmed = line.trim();
                if (trimmed.toLowerCase().startsWith("roles:")) {
                    String rolesStr = trimmed.substring(6).trim(); // Remove "roles:" prefix
                    if (!rolesStr.isEmpty()) {
                        return new HashSet<>(Arrays.asList(rolesStr.split(",")));
                    }
                }
            }
        } catch (Exception e) {
            logger.warnf("Failed to extract roles from description: %s", e.getMessage());
        }
        return null;
    }

    private boolean checkRoleBasedMembership(UserModel user, GroupModel group, Set<String> requiredRoles) {
        for (String role : requiredRoles) {
            if (isUserMemberOfRoleInHierarchy(user, group, role)) {
                return true; // User has at least one required role
            }
        }
        return false;
    }

    private boolean isUserMemberOfRoleInHierarchy(UserModel user, GroupModel group, String roleName) {
        Set<GroupModel> roleGroups = findRoleGroupsInHierarchy(group, roleName);
        return roleGroups.stream().anyMatch(roleGroup -> user.isMemberOf(roleGroup));
    }

    private Set<GroupModel> findRoleGroupsInHierarchy(GroupModel group, String roleName) {
        Set<GroupModel> roleGroups = new HashSet<>();
        Set<String> visited = new HashSet<>();
        collectRoleGroupsRecursive(group, roleName, roleGroups, visited);
        return roleGroups;
    }

    private void collectRoleGroupsRecursive(GroupModel group, String roleName, Set<GroupModel> roleGroups, Set<String> visited) {
        // Prevent infinite loops
        if (visited.contains(group.getId())) {
            return;
        }
        visited.add(group.getId());

        // Check direct role subgroups
        String roleGroupName = "role:" + roleName;
        group.getSubGroupsStream()
                .filter(subGroup -> roleGroupName.equals(subGroup.getName()))
                .forEach(roleGroups::add);

        // Recursively check parent groups
        GroupModel parent = group.getParent();
        if (parent != null) {
            collectRoleGroupsRecursive(parent, roleName, roleGroups, visited);
        }
    }

    @Override
    public void close() {

    }
}
