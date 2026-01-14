package com.volaticloud.keycloak.tenant.representations;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Response DTO for member operations (add/update).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberResponse {

    /**
     * User ID (UUID) of the member.
     */
    private String userId;

    /**
     * Resource ID (UUID) the member was added to.
     */
    private String resourceId;

    /**
     * Role assigned to the member.
     */
    private String role;

    /**
     * Whether the user was also added to a native Keycloak Organization.
     * Only true for organization-type resources.
     */
    private boolean addedToOrganization;
}