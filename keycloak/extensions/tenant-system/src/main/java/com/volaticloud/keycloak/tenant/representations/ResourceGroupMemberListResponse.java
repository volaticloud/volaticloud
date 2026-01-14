package com.volaticloud.keycloak.tenant.representations;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Paginated response for resource group member list.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceGroupMemberListResponse {
    private int totalCount;
    private boolean hasMore;
    private List<ResourceGroupMemberRepresentation> items;
    /**
     * Available roles for this resource group (e.g., ["admin", "viewer"]).
     * Extracted from role:* subgroups.
     */
    private List<String> availableRoles;
}