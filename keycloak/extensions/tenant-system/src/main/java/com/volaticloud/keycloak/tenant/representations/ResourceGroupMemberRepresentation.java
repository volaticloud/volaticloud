package com.volaticloud.keycloak.tenant.representations;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Represents a resource group member with user info and role(s).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceGroupMemberRepresentation {
    private MemberUser user;
    private List<String> roles;
    private String primaryRole;
}