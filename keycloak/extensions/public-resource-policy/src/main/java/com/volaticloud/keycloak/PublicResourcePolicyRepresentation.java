package com.volaticloud.keycloak;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.keycloak.representations.idm.authorization.AbstractPolicyRepresentation;

/**
 * Representation for PublicResourcePolicy configuration.
 *
 * This is a simple policy that doesn't require any special configuration.
 * It simply grants access to resources with public=true attribute.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class PublicResourcePolicyRepresentation extends AbstractPolicyRepresentation {

    private String description;

    public PublicResourcePolicyRepresentation() {
    }

    public String getType() {
        return "public-resource";
    }

    public String getDescription() {
        return description != null ? description :
            "Grants access to resources that have public=true attribute. " +
            "This allows any authenticated user to access public resources.";
    }

    public void setDescription(String description) {
        this.description = description;
    }
}