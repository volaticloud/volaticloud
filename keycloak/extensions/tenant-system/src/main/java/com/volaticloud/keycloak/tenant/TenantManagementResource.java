package com.volaticloud.keycloak.tenant;

import com.volaticloud.keycloak.tenant.representations.*;
import com.volaticloud.keycloak.tenant.services.*;

import java.util.List;
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
    private final ResourceManagementService resourceManagementService;
    private final MemberManagementService memberManagementService;
    private final InvitationService invitationService;

    public TenantManagementResource(KeycloakSession session) {
        this.session = session;
        this.resourceGroupService = new ResourceGroupService(session);
        this.memberService = new ResourceGroupMemberService(session);
        this.resourceManagementService = new ResourceManagementService(session);
        this.memberManagementService = new MemberManagementService(session);
        this.invitationService = new InvitationService(session);
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

    /**
     * POST /realms/{realm}/volaticloud/resources
     *
     * Creates a unified resource (UMA resource + Keycloak group) atomically.
     * Both the UMA resource and group are created in a single transaction.
     *
     * @param request Resource creation request
     * @return ResourceResponse with created resource details
     */
    @POST
    @Path("/resources")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createResource(ResourceCreateRequest request) {
        try {
            ResourceResponse response = resourceManagementService.createResource(request);
            return Response.status(Response.Status.CREATED).entity(response).build();
        } catch (IllegalArgumentException e) {
            return Response.status(400).entity(Map.of("error", e.getMessage())).build();
        } catch (IllegalStateException e) {
            return Response.status(409).entity(Map.of("error", e.getMessage())).build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    /**
     * PUT /realms/{realm}/volaticloud/resources/{id}
     *
     * Updates a unified resource (UMA resource + Keycloak group) atomically.
     * Updates both the UMA resource attributes and group attributes in a single transaction.
     *
     * @param resourceId Resource ID to update
     * @param request Update request with fields to change
     * @return ResourceResponse with updated resource details
     */
    @PUT
    @Path("/resources/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updateResource(
        @PathParam("id") String resourceId,
        ResourceUpdateRequest request
    ) {
        try {
            ResourceResponse response = resourceManagementService.updateResource(resourceId, request);
            return Response.ok(response).build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    /**
     * DELETE /realms/{realm}/volaticloud/resources/{id}
     *
     * Deletes a unified resource (UMA resource + Keycloak group) atomically.
     * Removes both the UMA resource and group (including subgroups) in a single transaction.
     *
     * @param resourceId Resource ID to delete
     * @return 204 No Content on success
     */
    @DELETE
    @Path("/resources/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteResource(@PathParam("id") String resourceId) {
        try {
            resourceManagementService.deleteResource(resourceId);
            return Response.noContent().build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    /**
     * POST /realms/{realm}/volaticloud/resources/{id}/enable
     *
     * Re-enables a previously disabled organization.
     * Only works for organization-type resources.
     *
     * @param resourceId Resource ID (organization alias)
     * @return 200 OK on success
     */
    @POST
    @Path("/resources/{id}/enable")
    @Produces(MediaType.APPLICATION_JSON)
    public Response enableResource(@PathParam("id") String resourceId) {
        try {
            resourceManagementService.enableOrganization(resourceId);
            return Response.ok(Map.of("message", "Organization enabled successfully")).build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (IllegalArgumentException e) {
            return Response.status(400).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    /**
     * GET /realms/{realm}/volaticloud/resources/{id}
     *
     * Gets details of a unified resource.
     *
     * @param resourceId Resource ID
     * @return ResourceResponse with resource details
     */
    @GET
    @Path("/resources/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getResource(@PathParam("id") String resourceId) {
        try {
            ResourceResponse response = resourceManagementService.getResource(resourceId);
            return Response.ok(response).build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    // ============================================================================
    // Member Management Endpoints
    // ============================================================================

    /**
     * POST /realms/{realm}/volaticloud/resources/{resourceId}/members
     *
     * Adds a member to a resource with a specified role.
     * For organization-type resources, also adds the user to the native Keycloak Organization.
     * Custom roles are created on-demand if they don't exist.
     *
     * @param resourceId Resource ID (UUID)
     * @param request AddMemberRequest with userId and role
     * @return MemberResponse with operation result
     */
    @POST
    @Path("/resources/{resourceId}/members")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response addMember(
        @PathParam("resourceId") String resourceId,
        AddMemberRequest request
    ) {
        try {
            // Validate request
            if (request.getUserId() == null || request.getUserId().isEmpty()) {
                return Response.status(400).entity(Map.of("error", "userId is required")).build();
            }
            if (request.getRole() == null || request.getRole().isEmpty()) {
                return Response.status(400).entity(Map.of("error", "role is required")).build();
            }

            MemberResponse response = memberManagementService.addMember(
                resourceId,
                request.getUserId(),
                request.getRole()
            );
            return Response.status(Response.Status.CREATED).entity(response).build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    /**
     * DELETE /realms/{realm}/volaticloud/resources/{resourceId}/members/{userId}
     *
     * Removes a member from a resource.
     * If role query parameter is provided, removes only from that specific role.
     * If no role specified, removes from all roles.
     * For organization-type resources, also removes from native Keycloak Organization
     * when the user has no remaining roles.
     *
     * @param resourceId Resource ID (UUID)
     * @param userId User ID (UUID)
     * @param role Optional role to remove from (if not specified, removes from all roles)
     * @return 204 No Content on success
     */
    @DELETE
    @Path("/resources/{resourceId}/members/{userId}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response removeMember(
        @PathParam("resourceId") String resourceId,
        @PathParam("userId") String userId,
        @QueryParam("role") String role
    ) {
        try {
            if (role != null && !role.isEmpty()) {
                memberManagementService.removeMemberRole(resourceId, userId, role);
            } else {
                memberManagementService.removeMember(resourceId, userId);
            }
            return Response.noContent().build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    // ============================================================================
    // Invitation Management Endpoints
    // ============================================================================

    /**
     * POST /realms/{realm}/volaticloud/resources/{resourceId}/invitations
     *
     * Creates an invitation for a user to join an organization.
     * Uses Keycloak's native organization invitation system.
     * All invited users are assigned the 'viewer' role by default upon acceptance.
     *
     * @param resourceId Organization resource ID
     * @param request InvitationRequest with email, firstName, lastName
     * @return InvitationResponse with invitation details including invite link
     */
    @POST
    @Path("/resources/{resourceId}/invitations")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createInvitation(
        @PathParam("resourceId") String resourceId,
        InvitationRequest request
    ) {
        try {
            if (request.getEmail() == null || request.getEmail().isEmpty()) {
                return Response.status(400).entity(Map.of("error", "email is required")).build();
            }

            InvitationResponse response = invitationService.createInvitation(resourceId, request);
            return Response.status(Response.Status.CREATED).entity(response).build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (IllegalArgumentException e) {
            return Response.status(400).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    /**
     * GET /realms/{realm}/volaticloud/resources/{resourceId}/invitations
     *
     * Lists pending invitations for an organization.
     *
     * @param resourceId Organization resource ID
     * @param first Number of invitations to return (default: 20)
     * @param max Maximum number of invitations (default: 100)
     * @return InvitationListResponse with list of pending invitations
     */
    @GET
    @Path("/resources/{resourceId}/invitations")
    @Produces(MediaType.APPLICATION_JSON)
    public Response listInvitations(
        @PathParam("resourceId") String resourceId,
        @QueryParam("first") @DefaultValue("20") int first,
        @QueryParam("max") @DefaultValue("100") int max
    ) {
        try {
            List<InvitationResponse> invitations = invitationService.listInvitations(resourceId, first, max);
            return Response.ok(new InvitationListResponse(invitations, invitations.size())).build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }

    /**
     * DELETE /realms/{realm}/volaticloud/resources/{resourceId}/invitations/{invitationId}
     *
     * Deletes (cancels) an invitation before it's accepted.
     *
     * @param resourceId Organization resource ID (for authorization context)
     * @param invitationId Invitation ID to delete
     * @return 204 No Content on success
     */
    @DELETE
    @Path("/resources/{resourceId}/invitations/{invitationId}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteInvitation(
        @PathParam("resourceId") String resourceId,
        @PathParam("invitationId") String invitationId
    ) {
        try {
            invitationService.deleteInvitation(resourceId, invitationId);
            return Response.noContent().build();
        } catch (NotFoundException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            return Response.status(500).entity(Map.of("error", "Internal server error: " + e.getMessage())).build();
        }
    }
}