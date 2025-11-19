package com.volaticloud.keycloak;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.keycloak.representations.idm.authorization.AbstractPolicyRepresentation;

import java.util.Set;

@JsonIgnoreProperties(ignoreUnknown = true)
public class GroupResourcePolicyRepresentation extends AbstractPolicyRepresentation {

    // Keep a simple structure for admin dashboard compatibility
    // Note: This policy gets groupId/groupAlias from resource attributes at runtime
    private String description;
    private Set<String> roles;

    public GroupResourcePolicyRepresentation() {
    }

    public String getType() {
        return "group-resource";
    }

    public String getDescription() {
        return description != null ? description : "Checks if user belongs to the group specified in resource attributes. To enable role-based access, add 'Roles: admin,viewer' to the description.";
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Set<String> getRoles() {
        return roles;
    }

    public void setRoles(Set<String> roles) {
        this.roles = roles;
    }
}
