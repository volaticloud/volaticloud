package com.volaticloud.keycloak.tenant.representations;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Paginated response for resource group list.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceGroupListResponse {
    private int totalCount;
    private boolean hasMore;
    private List<ResourceGroupRepresentation> items;
}