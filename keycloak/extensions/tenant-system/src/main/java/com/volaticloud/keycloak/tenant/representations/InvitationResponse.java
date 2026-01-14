package com.volaticloud.keycloak.tenant.representations;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Response DTO for organization invitation operations.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvitationResponse {

    /**
     * Invitation ID (UUID).
     */
    private String id;

    /**
     * Email address of the invited user.
     */
    private String email;

    /**
     * First name of the invited user.
     */
    private String firstName;

    /**
     * Last name of the invited user.
     */
    private String lastName;

    /**
     * Resource ID (organization) the user is invited to.
     */
    private String resourceId;

    /**
     * Invitation status (PENDING, EXPIRED).
     */
    private String status;

    /**
     * Timestamp when invitation was created (epoch milliseconds).
     */
    private long createdAt;

    /**
     * Timestamp when invitation expires (epoch milliseconds).
     */
    private long expiresAt;

    /**
     * The invitation link the user should click to accept.
     */
    private String inviteLink;
}
