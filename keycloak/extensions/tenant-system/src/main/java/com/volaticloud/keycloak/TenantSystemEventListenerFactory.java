package com.volaticloud.keycloak;

import com.google.auto.service.AutoService;
import org.keycloak.Config;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

@AutoService(EventListenerProviderFactory.class)
public class TenantSystemEventListenerFactory implements EventListenerProviderFactory {

    private static final String PROVIDER_ID = "tenant-system";

    @Override
    public EventListenerProvider create(KeycloakSession session) {
        return new TenantSystemEventListener(session);
    }

    @Override
    public void init(Config.Scope config) {
        // No initialization needed
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
        // No post-initialization needed
    }

    @Override
    public void close() {
        // No cleanup needed
    }

    @Override
    public String getId() {
        return PROVIDER_ID;
    }
}