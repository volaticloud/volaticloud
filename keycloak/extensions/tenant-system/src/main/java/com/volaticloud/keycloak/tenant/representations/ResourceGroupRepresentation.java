package com.volaticloud.keycloak.tenant.representations;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Normalized representation of a resource group.
 * Roles are extracted from role:* subgroups and presented as a property.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceGroupRepresentation {
    private String name;
    private String path;
    private String title;
    private List<RoleInfoRepresentation> roles;
    private int totalMembers;
    private boolean hasChildren;
}