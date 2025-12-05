package com.volaticloud.keycloak;

import java.util.*;

import com.google.auto.service.AutoService;
import org.keycloak.Config;
import org.keycloak.authorization.AuthorizationProvider;
import org.keycloak.authorization.model.Policy;
import org.keycloak.authorization.policy.provider.PolicyProvider;
import org.keycloak.authorization.policy.provider.PolicyProviderFactory;
import org.keycloak.models.*;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.representations.idm.authorization.PolicyRepresentation;

/**
 * Factory for PublicResourcePolicyProvider.
 *
 * This policy type grants access to resources that have public=true attribute.
 * It appears in the Keycloak admin console under "Identity Based" policies.
 *
 * Usage:
 * 1. Create a permission in Keycloak
 * 2. Associate this policy with the permission
 * 3. Resources with public=true attribute will be accessible to any authenticated user
 */
@AutoService(PolicyProviderFactory.class)
public class PublicResourcePolicyProviderFactory implements PolicyProviderFactory<PublicResourcePolicyRepresentation> {

    private final PublicResourcePolicyProvider provider = new PublicResourcePolicyProvider();

    @Override
    public String getName() {
        return "Public Resource";
    }

    @Override
    public String getGroup() {
        return "Identity Based";
    }

    @Override
    public PolicyProvider create(AuthorizationProvider authorization) {
        return provider;
    }

    @Override
    public PolicyProvider create(KeycloakSession session) {
        return null;
    }

    @Override
    public PublicResourcePolicyRepresentation toRepresentation(Policy policy, AuthorizationProvider authorization) {
        PublicResourcePolicyRepresentation representation = new PublicResourcePolicyRepresentation();

        // Get description from policy config if available
        String description = policy.getConfig().get("description");
        if (description != null) {
            representation.setDescription(description);
        }

        return representation;
    }

    @Override
    public Class<PublicResourcePolicyRepresentation> getRepresentationType() {
        return PublicResourcePolicyRepresentation.class;
    }

    @Override
    public void onCreate(Policy policy, PublicResourcePolicyRepresentation representation, AuthorizationProvider authorization) {
        // Store description if provided
        if (representation.getDescription() != null) {
            policy.putConfig("description", representation.getDescription());
        }
    }

    @Override
    public void onUpdate(Policy policy, PublicResourcePolicyRepresentation representation, AuthorizationProvider authorization) {
        // Store description if provided
        if (representation.getDescription() != null) {
            policy.putConfig("description", representation.getDescription());
        }
    }

    @Override
    public void onImport(Policy policy, PolicyRepresentation representation, AuthorizationProvider authorization) {
        // Handle description from imported config
        String description = representation.getConfig().get("description");
        if (description != null) {
            policy.putConfig("description", description);
        }
    }

    @Override
    public void onExport(Policy policy, PolicyRepresentation representation, AuthorizationProvider authorizationProvider) {
        Map<String, String> config = new HashMap<>();

        // Export description if available
        String description = policy.getConfig().get("description");
        if (description != null) {
            config.put("description", description);
        }

        representation.setConfig(config);
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
        // No resources to clean up
    }

    @Override
    public String getId() {
        return "public-resource";
    }

    @Override
    public List<ProviderConfigProperty> getConfigMetadata() {
        return Collections.emptyList();
    }
}