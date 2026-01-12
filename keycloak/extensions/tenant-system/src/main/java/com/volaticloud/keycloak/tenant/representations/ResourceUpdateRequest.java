package com.volaticloud.keycloak.tenant.representations;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Request DTO for updating a unified resource.
 *
 * This updates both UMA resource attributes and Keycloak group attributes atomically.
 * All fields are optional - only provided fields will be updated.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceUpdateRequest {

    /**
     * Display title for the resource (updates GROUP_TITLE attribute).
     * If null, title is not updated.
     */
    private String title;

    /**
     * Additional attributes for UMA resource (e.g., {"public": "false"}).
     * These will be merged with existing UMA resource attributes.
     * If null, attributes are not updated.
     */
    private Map<String, List<String>> attributes;
}