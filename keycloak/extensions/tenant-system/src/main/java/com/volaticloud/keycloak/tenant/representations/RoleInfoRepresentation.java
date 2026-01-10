package com.volaticloud.keycloak.tenant.representations;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents role information (name + member count).
 * Part of normalized resource group structure.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoleInfoRepresentation {
    private String name;
    private int memberCount;
}