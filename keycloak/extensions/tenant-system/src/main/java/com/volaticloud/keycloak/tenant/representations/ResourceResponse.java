package com.volaticloud.keycloak.tenant.representations;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Response DTO for resource operations.
 *
 * Returns information about both the UMA resource and Keycloak group.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceResponse {

    /**
     * Resource ID (UMA resource name / group name).
     */
    private String id;

    /**
     * Display title from GROUP_TITLE attribute.
     */
    private String title;

    /**
     * Resource type from GROUP_TYPE attribute.
     */
    private String type;

    /**
     * Parent resource ID (ownerId).
     */
    private String ownerId;

    /**
     * Keycloak group ID (different from resource ID/name).
     */
    private String groupId;

    /**
     * UMA resource ID (Keycloak internal ID).
     */
    private String umaResourceId;

    /**
     * Scopes available for this resource.
     */
    private List<String> scopes;

    /**
     * UMA resource attributes.
     */
    private Map<String, List<String>> attributes;
}