package com.volaticloud.keycloak.tenant.representations;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Request DTO for adding a member to a resource with a specific role.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AddMemberRequest {

    /**
     * User ID (UUID) of the user to add as a member.
     */
    private String userId;

    /**
     * Role name to assign to the user (e.g., "admin", "viewer", "editor").
     * Will be stored as a role:X subgroup under the resource group.
     */
    private String role;
}