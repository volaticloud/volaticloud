package com.volaticloud.keycloak.tenant;

/**
 * Exception thrown when a resource group or parent group is not found.
 */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }

    public NotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}