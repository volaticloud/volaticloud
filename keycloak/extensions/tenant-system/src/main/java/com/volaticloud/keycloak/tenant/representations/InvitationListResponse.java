package com.volaticloud.keycloak.tenant.representations;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

/**
 * Response DTO for listing organization invitations.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvitationListResponse {

    /**
     * List of invitations.
     */
    private List<InvitationResponse> invitations;

    /**
     * Total number of invitations.
     */
    private int total;
}
