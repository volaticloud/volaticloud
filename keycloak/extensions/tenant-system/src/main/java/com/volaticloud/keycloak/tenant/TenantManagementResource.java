package com.volaticloud.keycloak.tenant;

import com.volaticloud.keycloak.tenant.representations.*;
import com.volaticloud.keycloak.tenant.services.*;
import org.keycloak.models.KeycloakSession;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;

/**
 * REST resource for tenant/resource group management.
 *
 * Provides endpoints for:
 * - Listing resource groups (strategies, bots, etc.) with normalized role data
 * - Listing members of resource groups filtered by role
 *
 * All resource types (organizations, strategies, bots) share the same structure
 * with role:* subgroups, so these endpoints work generically.
 */
public class TenantManagementResource {

    private final KeycloakSession session;
    private final ResourceGroupService resourceGroupService;
    private final ResourceGroupMemberService memberService;

    public TenantManagementResource(KeycloakSession session) {
        this.session = session;
        this.resourceGroupService = new ResourceGroupService(session);
        this.memberService = new ResourceGroupMemberService(session);
    }

    /**
     * GET /realms/{realm}/volaticloud/organizations/{orgId}/resource-groups
     *
     * Returns paginated list of resource groups (strategies, bots, etc.) under a parent group.
     * Normalizes Keycloak's nested structure by extracting role:* subgroups into roles array.
     *
     * @param parentGroupId Parent group ID (e.g., organization ID)
     * @param search Search by title (case-insensitive)
     * @param first Page size (default: 20, max: 100)
     * @param offset Skip N items (default: 0)
     * @param orderBy Sort field: title, totalMembers (default: title)
     * @param order Sort direction: asc, desc (default: asc)
     * @return Paginated list of resource groups with normalized role data
     */
    @GET
    @Path("/organizations/{orgId}/resource-groups")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getResourceGroups(
        @PathParam("orgId") String parentGroupId,
        @QueryParam("search") String search,
        @QueryParam("first") @DefaultValue("20") int first,
        @QueryParam("offset") @DefaultValue("0") int offset,
        @QueryParam("orderBy") @DefaultValue("title") String orderBy,
        @QueryParam("order") @DefaultValue("asc") String order
    ) {
        try {
            // Validate parameters
            if (first > 100) first = 100;
            if (first < 1) first = 20;
            if (offset < 0) offset = 0;

            // Call service layer
            ResourceGroupListResponse response = resourceGroupService.getResourceGroups(
                parentGroupId, search, first, offset, orderBy, order
            );

            return Response.ok(response).build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    /**
     * GET /realms/{realm}/volaticloud/organizations/{orgId}/resource-groups/{resourceId}/members
     *
     * Returns filtered, searchable, sortable list of members for a resource group.
     * Supports role-based filtering, user search, and pagination.
     *
     * @param parentGroupId Parent group ID (for authorization context)
     * @param resourceGroupId Resource group ID
     * @param role Filter by specific role (e.g., "admin")
     * @param roles Filter by multiple roles (comma-separated: "admin,editor")
     * @param search Search username, email, firstName, lastName (case-insensitive)
     * @param enabled Filter by user enabled status
     * @param emailVerified Filter by email verified status
     * @param first Page size (default: 50, max: 100)
     * @param offset Skip N items (default: 0)
     * @param orderBy Sort field: username, email, firstName, lastName, createdAt, primaryRole
     * @param order Sort direction: asc, desc
     * @return Paginated list of members with role information
     */
    @GET
    @Path("/organizations/{orgId}/resource-groups/{resourceId}/members")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getResourceGroupMembers(
        @PathParam("orgId") String parentGroupId,
        @PathParam("resourceId") String resourceGroupId,
        @QueryParam("role") String role,
        @QueryParam("roles") String roles,
        @QueryParam("search") String search,
        @QueryParam("enabled") Boolean enabled,
        @QueryParam("emailVerified") Boolean emailVerified,
        @QueryParam("first") @DefaultValue("50") int first,
        @QueryParam("offset") @DefaultValue("0") int offset,
        @QueryParam("orderBy") @DefaultValue("username") String orderBy,
        @QueryParam("order") @DefaultValue("asc") String order
    ) {
        try {
            // Validate parameters
            if (first > 100) first = 100;
            if (first < 1) first = 50;
            if (offset < 0) offset = 0;

            // Parse roles parameter (comma-separated)
            String[] roleArray = null;
            if (role != null && !role.isEmpty()) {
                roleArray = new String[]{role};
            } else if (roles != null && !roles.isEmpty()) {
                roleArray = roles.split(",");
                // Trim whitespace
                for (int i = 0; i < roleArray.length; i++) {
                    roleArray[i] = roleArray[i].trim();
                }
            }

            // Call service layer
            ResourceGroupMemberListResponse response = memberService.getMembers(
                parentGroupId, resourceGroupId, roleArray, search,
                enabled, emailVerified, first, offset, orderBy, order
            );

            return Response.ok(response).build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }
}