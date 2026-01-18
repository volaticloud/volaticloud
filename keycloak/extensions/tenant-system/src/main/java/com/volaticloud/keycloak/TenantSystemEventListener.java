package com.volaticloud.keycloak;

import lombok.RequiredArgsConstructor;
import lombok.extern.jbosslog.JBossLog;
import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.OperationType;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.*;
import org.keycloak.organization.OrganizationProvider;

/**
 * Multi-tenant system event listener that manages user-organization membership.
 *
 * <p>Handles the following events:
 * <ul>
 *   <li>USER registration (self-signup) - Adds user to invited organizations if applicable</li>
 *   <li>ORGANIZATION_MEMBERSHIP CREATE - Adds user to role subgroup when joining org via invitation</li>
 * </ul>
 *
 * <p>Note: Organization creation is now handled manually via the dashboard API
 * (/realms/{realm}/volaticloud/resources endpoint). This event listener only handles
 * user membership in existing organizations.
 */
@JBossLog
@RequiredArgsConstructor
public class TenantSystemEventListener implements EventListenerProvider {

    private static final String ROLE_ADMIN = "role:admin";
    private static final String ROLE_VIEWER = "role:viewer";
    private static final String DEFAULT_INVITATION_ROLE = "viewer";

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
                // Handle ORGANIZATION_MEMBERSHIP CREATE (member added to org via invitation)
                if (event.getResourceType() == ResourceType.ORGANIZATION_MEMBERSHIP) {
                    handleOrganizationMemberAdded(event);
                    return;
                }
            }
        } catch (Exception e) {
            log.errorf(e, "Error processing admin event for tenant system");
        }
    }

    /**
     * Handles user registration event (self-signup).
     * If user was invited to an organization, adds them to the viewer role.
     * Organization creation is now done manually via the dashboard.
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

        // Check if user was invited to any organization and add them to the viewer role
        // This handles the case where user registered via invitation link
        addInvitedUserToViewerRole(realm, user);

        log.infof("User registration processed: userId=%s. User can create organization via dashboard.", userId);
    }

    /**
     * Checks if a newly registered user is a member of any native organizations
     * and adds them to the viewer role subgroup.
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

    @Override
    public void close() {
        // No cleanup needed
    }
}