package com.volaticloud.keycloak.tenant.representations;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * User representation for resource group members.
 * Avoids conflict with Keycloak's org.keycloak.representations.idm.UserRepresentation.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberUser {
    private String id;
    private String username;
    private String email;
    private Boolean emailVerified;
    private String firstName;
    private String lastName;
    private Boolean enabled;
    private Long createdTimestamp;
}