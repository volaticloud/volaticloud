package com.volaticloud.keycloak.tenant.representations;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Request DTO for creating a unified resource (UMA resource + Keycloak group).
 *
 * This represents a single atomic operation that creates both:
 * - UMA resource for authorization
 * - Keycloak group for organizational hierarchy
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceCreateRequest {

    /**
     * Resource ID (will be used as both UMA resource name and group name).
     * Typically a UUID.
     */
    private String id;

    /**
     * Display title for the resource (stored in GROUP_TITLE attribute).
     */
    private String title;

    /**
     * Resource type: strategy, bot, exchange, runner, organization.
     * Stored in GROUP_TYPE attribute.
     */
    private String type;

    /**
     * Parent resource ID (ownerId).
     * If provided, creates group as child of parent group.
     * If null, creates at root level.
     */
    private String ownerId;

    /**
     * Scopes for authorization (e.g., ["view", "edit", "delete"]).
     * Used when creating UMA resource.
     */
    private List<String> scopes;

    /**
     * Additional attributes for UMA resource (e.g., {"public": "true"}).
     * These will be stored on the UMA resource, not the group.
     */
    private Map<String, List<String>> attributes;
}