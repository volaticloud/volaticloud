package com.volaticloud.keycloak;

import org.jboss.logging.Logger;
import org.keycloak.authorization.model.Resource;
import org.keycloak.authorization.policy.evaluation.Evaluation;
import org.keycloak.authorization.policy.provider.PolicyProvider;

import java.util.List;
import java.util.Map;

/**
 * Policy provider that grants access to resources with public=true attribute.
 *
 * This policy checks if the resource being accessed has a "public" attribute
 * with value "true". If so, access is granted to any authenticated user.
 *
 * Resource attributes are set when creating/updating resources in Keycloak.
 * The backend syncs the "public" attribute when visibility is toggled.
 */
public class PublicResourcePolicyProvider implements PolicyProvider {

    private static final Logger logger = Logger.getLogger(PublicResourcePolicyProvider.class);
    private static final String PUBLIC_ATTRIBUTE = "public";
    private static final String TRUE_VALUE = "true";

    public PublicResourcePolicyProvider() {
    }

    @Override
    public void evaluate(Evaluation evaluation) {
        Resource resource = evaluation.getPermission().getResource();

        if (resource == null) {
            logger.debugf("No resource found for policy %s, abstaining", evaluation.getPolicy().getName());
            return; // Abstain - let other policies decide
        }

        String resourceName = resource.getName();
        Map<String, List<String>> attributes = resource.getAttributes();

        if (attributes == null || attributes.isEmpty()) {
            logger.debugf("Resource %s has no attributes, abstaining", resourceName);
            return; // Abstain - no attributes means not explicitly public
        }

        // Check if resource has public=true attribute
        List<String> publicValues = attributes.get(PUBLIC_ATTRIBUTE);

        if (publicValues != null && publicValues.contains(TRUE_VALUE)) {
            logger.debugf("Resource %s is public, granting access", resourceName);
            evaluation.grant();
            return;
        }

        // Abstain for non-public resources - let other policies (like group-resource) decide
        logger.debugf("Resource %s is not public (public=%s), abstaining",
            resourceName, publicValues);
    }

    @Override
    public void close() {
        // No resources to clean up
    }
}