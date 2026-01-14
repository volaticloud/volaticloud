package com.volaticloud.keycloak.tenant.representations;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Request DTO for creating an organization invitation.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvitationRequest {

    /**
     * Email address of the user to invite (required).
     */
    private String email;

    /**
     * First name of the user (optional).
     */
    private String firstName;

    /**
     * Last name of the user (optional).
     */
    private String lastName;

    /**
     * Redirect URL after invitation acceptance (optional).
     * If not provided, uses the default dashboard URL.
     */
    private String redirectUrl;

    /**
     * Client ID to use for the invitation flow (optional).
     * If not provided, uses the default dashboard client.
     */
    private String clientId;
}
