package com.volaticloud.keycloak;

import com.google.auto.service.AutoService;
import lombok.extern.jbosslog.JBossLog;
import org.keycloak.models.ClientSessionContext;
import org.keycloak.models.GroupModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.ProtocolMapperModel;
import org.keycloak.models.UserSessionModel;
import org.keycloak.protocol.ProtocolMapper;
import org.keycloak.protocol.oidc.mappers.AbstractOIDCProtocolMapper;
import org.keycloak.protocol.oidc.mappers.OIDCAccessTokenMapper;
import org.keycloak.protocol.oidc.mappers.OIDCAttributeMapperHelper;
import org.keycloak.protocol.oidc.mappers.OIDCIDTokenMapper;
import org.keycloak.protocol.oidc.mappers.UserInfoTokenMapper;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.representations.IDToken;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * OIDC Protocol Mapper that adds organization titles to tokens.
 * Maps organization UUID to its GROUP_TITLE attribute for groups with GROUP_TYPE=organization.
 *
 * Token claim format:
 * {
 *   "organization_titles": {
 *     "uuid-1": "Sam's Organization",
 *     "uuid-2": "John's Organization"
 *   }
 * }
 */
@JBossLog
@AutoService(ProtocolMapper.class)
public class OrganizationTitleMapper extends AbstractOIDCProtocolMapper
        implements OIDCAccessTokenMapper, OIDCIDTokenMapper, UserInfoTokenMapper {

    public static final String PROVIDER_ID = "organization-title-mapper";
    private static final String GROUP_TYPE_ATTRIBUTE = "GROUP_TYPE";
    private static final String GROUP_TITLE_ATTRIBUTE = "GROUP_TITLE";
    private static final String GROUP_TYPE_ORGANIZATION = "organization";

    private static final List<ProviderConfigProperty> configProperties = new ArrayList<>();

    static {
        OIDCAttributeMapperHelper.addTokenClaimNameConfig(configProperties);
        OIDCAttributeMapperHelper.addIncludeInTokensConfig(configProperties, OrganizationTitleMapper.class);
    }

    @Override
    public String getId() {
        return PROVIDER_ID;
    }

    @Override
    public String getDisplayType() {
        return "Organization Titles";
    }

    @Override
    public String getDisplayCategory() {
        return TOKEN_MAPPER_CATEGORY;
    }

    @Override
    public String getHelpText() {
        return "Maps organization UUIDs to their titles (GROUP_TITLE attribute) for groups with GROUP_TYPE=organization";
    }

    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        return configProperties;
    }

    @Override
    protected void setClaim(IDToken token, ProtocolMapperModel mappingModel,
                            UserSessionModel userSession, KeycloakSession keycloakSession,
                            ClientSessionContext clientSessionCtx) {

        Map<String, String> organizationTitles = new HashMap<>();

        // Get all groups the user belongs to
        Stream<GroupModel> userGroups = userSession.getUser().getGroupsStream();

        userGroups.forEach(group -> {
            // Find the root organization group by traversing up the hierarchy
            GroupModel orgGroup = findOrganizationGroup(group);
            if (orgGroup != null) {
                String orgId = orgGroup.getName();
                // Only add if not already present
                if (!organizationTitles.containsKey(orgId)) {
                    String title = getGroupTitle(orgGroup);
                    if (title != null) {
                        organizationTitles.put(orgId, title);
                        log.debugf("Added organization title: %s -> %s", orgId, title);
                    }
                }
            }
        });

        if (!organizationTitles.isEmpty()) {
            String claimName = mappingModel.getConfig().get(OIDCAttributeMapperHelper.TOKEN_CLAIM_NAME);
            if (claimName == null || claimName.isEmpty()) {
                claimName = "organization_titles";
            }
            token.getOtherClaims().put(claimName, organizationTitles);
            log.infof("Added %d organization titles to token", organizationTitles.size());
        }
    }

    /**
     * Finds the organization group by traversing up the group hierarchy.
     * Returns the group with GROUP_TYPE=organization, or null if not found.
     */
    private GroupModel findOrganizationGroup(GroupModel group) {
        GroupModel current = group;

        while (current != null) {
            String groupType = getGroupAttribute(current, GROUP_TYPE_ATTRIBUTE);
            if (GROUP_TYPE_ORGANIZATION.equals(groupType)) {
                return current;
            }
            current = current.getParent();
        }

        return null;
    }

    /**
     * Gets the GROUP_TITLE attribute from a group.
     */
    private String getGroupTitle(GroupModel group) {
        return getGroupAttribute(group, GROUP_TITLE_ATTRIBUTE);
    }

    /**
     * Gets a single-valued attribute from a group.
     */
    private String getGroupAttribute(GroupModel group, String attributeName) {
        Map<String, List<String>> attributes = group.getAttributes();
        if (attributes != null && attributes.containsKey(attributeName)) {
            List<String> values = attributes.get(attributeName);
            if (values != null && !values.isEmpty()) {
                return values.get(0);
            }
        }
        return null;
    }

    /**
     * Creates a default protocol mapper model for this mapper.
     */
    public static ProtocolMapperModel create(String name, boolean accessToken, boolean idToken, boolean userInfo) {
        ProtocolMapperModel mapper = new ProtocolMapperModel();
        mapper.setName(name);
        mapper.setProtocolMapper(PROVIDER_ID);
        mapper.setProtocol("openid-connect");

        Map<String, String> config = new HashMap<>();
        config.put(OIDCAttributeMapperHelper.TOKEN_CLAIM_NAME, "organization_titles");
        config.put(OIDCAttributeMapperHelper.INCLUDE_IN_ACCESS_TOKEN, String.valueOf(accessToken));
        config.put(OIDCAttributeMapperHelper.INCLUDE_IN_ID_TOKEN, String.valueOf(idToken));
        config.put(OIDCAttributeMapperHelper.INCLUDE_IN_USERINFO, String.valueOf(userInfo));

        mapper.setConfig(config);
        return mapper;
    }
}