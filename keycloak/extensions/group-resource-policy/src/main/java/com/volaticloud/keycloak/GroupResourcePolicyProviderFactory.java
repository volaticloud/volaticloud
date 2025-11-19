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

@AutoService(PolicyProviderFactory.class)
public class GroupResourcePolicyProviderFactory implements PolicyProviderFactory<GroupResourcePolicyRepresentation> {

    private final GroupResourcePolicyProvider provider = new GroupResourcePolicyProvider();

    @Override
    public String getName() {
        return "Group Resource";
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
    public GroupResourcePolicyRepresentation toRepresentation(Policy policy, AuthorizationProvider authorization) {
        GroupResourcePolicyRepresentation representation = new GroupResourcePolicyRepresentation();

        // Get description from policy config if available
        String description = policy.getConfig().get("description");
        if (description != null) {
            representation.setDescription(description);
        }

        // Get roles from policy config if available
        String rolesConfig = policy.getConfig().get("roles");
        if (rolesConfig != null && !rolesConfig.isEmpty()) {
            Set<String> roles = new HashSet<>(Arrays.asList(rolesConfig.split(",")));
            representation.setRoles(roles);
        }

        return representation;
    }

    @Override
    public Class<GroupResourcePolicyRepresentation> getRepresentationType() {
        return GroupResourcePolicyRepresentation.class;
    }

    @Override
    public void onCreate(Policy policy, GroupResourcePolicyRepresentation representation, AuthorizationProvider authorization) {
        // Store description if provided
        if (representation.getDescription() != null) {
            policy.putConfig("description", representation.getDescription());
        }

        // Store roles if provided
        if (representation.getRoles() != null && !representation.getRoles().isEmpty()) {
            policy.putConfig("roles", String.join(",", representation.getRoles()));
        }
    }

    @Override
    public void onUpdate(Policy policy, GroupResourcePolicyRepresentation representation, AuthorizationProvider authorization) {
        // Store description if provided
        if (representation.getDescription() != null) {
            policy.putConfig("description", representation.getDescription());
        }

        // Store roles if provided
        if (representation.getRoles() != null && !representation.getRoles().isEmpty()) {
            policy.putConfig("roles", String.join(",", representation.getRoles()));
        }
    }

    @Override
    public void onImport(Policy policy, PolicyRepresentation representation, AuthorizationProvider authorization) {
        // Handle description from imported config
        String description = representation.getConfig().get("description");
        if (description != null) {
            policy.putConfig("description", description);
        }

        // Handle roles from imported config
        String roles = representation.getConfig().get("roles");
        if (roles != null) {
            policy.putConfig("roles", roles);
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

        // Export roles if available
        String roles = policy.getConfig().get("roles");
        if (roles != null) {
            config.put("roles", roles);
        }

        representation.setConfig(config);
    }



    @Override
    public void init(Config.Scope config) {

    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {

    }

    @Override
    public void close() {

    }

    @Override
    public String getId() {
        return "group-resource";
    }

    @Override
    public List<ProviderConfigProperty> getConfigMetadata() {
        return Collections.emptyList();
    }

}
