package com.volaticloud.keycloak.tenant;

import com.google.auto.service.AutoService;
import org.keycloak.Config;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.services.resource.RealmResourceProvider;
import org.keycloak.services.resource.RealmResourceProviderFactory;

/**
 * Factory for tenant/resource management REST API provider.
 * Registers custom endpoints under /realms/{realm}/volaticloud/
 *
 * This API works for ALL resource types (organizations, strategies, bots, etc.)
 * as they all share the same group structure with role:* subgroups.
 */
@AutoService(RealmResourceProviderFactory.class)
public class TenantResourceProviderFactory implements RealmResourceProviderFactory {

    public static final String ID = "volaticloud";

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public RealmResourceProvider create(KeycloakSession session) {
        return new TenantResourceProvider(session);
    }

    @Override
    public void init(Config.Scope config) {}

    @Override
    public void postInit(KeycloakSessionFactory factory) {}

    @Override
    public void close() {}
}