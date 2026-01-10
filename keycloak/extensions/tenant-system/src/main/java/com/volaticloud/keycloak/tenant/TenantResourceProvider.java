package com.volaticloud.keycloak.tenant;

import org.keycloak.models.KeycloakSession;
import org.keycloak.services.resource.RealmResourceProvider;

/**
 * Provides access to tenant management REST resources.
 * Exposes endpoints for managing resource groups and members.
 */
public class TenantResourceProvider implements RealmResourceProvider {

    private final KeycloakSession session;

    public TenantResourceProvider(KeycloakSession session) {
        this.session = session;
    }

    @Override
    public Object getResource() {
        return new TenantManagementResource(session);
    }

    @Override
    public void close() {}
}