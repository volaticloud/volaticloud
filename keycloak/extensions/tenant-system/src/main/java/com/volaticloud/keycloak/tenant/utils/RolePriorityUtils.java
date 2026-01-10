package com.volaticloud.keycloak.tenant.utils;

import java.util.*;

/**
 * Utility for determining primary role based on priority.
 * Priority: owner > admin > editor > viewer > custom roles
 */
public class RolePriorityUtils {

    private static final Map<String, Integer> ROLE_PRIORITIES = new HashMap<>();

    static {
        ROLE_PRIORITIES.put("owner", 100);
        ROLE_PRIORITIES.put("admin", 80);
        ROLE_PRIORITIES.put("editor", 60);
        ROLE_PRIORITIES.put("viewer", 40);
    }

    /**
     * Determines the primary (highest priority) role from a list of roles.
     *
     * @param roles List of role names
     * @return Primary role name, or empty string if no roles
     */
    public String determinePrimaryRole(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return "";
        }

        return roles.stream()
            .max(Comparator.comparing(role -> ROLE_PRIORITIES.getOrDefault(role, 0)))
            .orElse(roles.get(0));
    }
}