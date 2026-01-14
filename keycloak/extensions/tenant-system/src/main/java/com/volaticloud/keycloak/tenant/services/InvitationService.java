package com.volaticloud.keycloak.tenant.services;

import com.volaticloud.keycloak.tenant.NotFoundException;
import com.volaticloud.keycloak.tenant.representations.InvitationRequest;
import com.volaticloud.keycloak.tenant.representations.InvitationResponse;
import lombok.extern.jbosslog.JBossLog;
import org.keycloak.OAuth2Constants;
import org.keycloak.authentication.actiontoken.inviteorg.InviteOrgActionToken;
import org.keycloak.common.util.Time;
import org.keycloak.email.EmailException;
import org.keycloak.email.EmailTemplateProvider;
import org.keycloak.models.*;
import org.keycloak.organization.OrganizationProvider;
import org.keycloak.protocol.oidc.OIDCLoginProtocolService;
import org.keycloak.services.resources.LoginActionsService;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service for managing organization invitations.
 *
 * <p>Uses Keycloak 26's native InvitationManager to create, list, and delete invitations.
 * All invited users are assigned the default 'viewer' role upon acceptance (handled by event listener).
 */
@JBossLog
public class InvitationService {

    private static final String GROUP_TYPE_ATTRIBUTE = "GROUP_TYPE";
    private static final String RESOURCE_TYPE_ORGANIZATION = "organization";
    private static final String DASHBOARD_CLIENT_ID = "dashboard";

    // RFC 5322 simplified email validation pattern
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    );

    private final KeycloakSession session;

    public InvitationService(KeycloakSession session) {
        this.session = session;
    }

    /**
     * Creates an invitation for a user to join an organization.
     * Uses Keycloak's native InvitationManager.
     * All invited users will be assigned the default role (viewer) upon acceptance.
     *
     * @param resourceId Organization resource ID (alias)
     * @param request Invitation request with email, firstName, lastName
     * @return InvitationResponse with invitation details
     * @throws NotFoundException if resource or organization not found
     * @throws IllegalArgumentException if resource is not an organization
     * @throws Exception if invitation creation fails
     */
    public InvitationResponse createInvitation(String resourceId, InvitationRequest request) throws Exception {
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            throw new Exception("Could not get realm from session context");
        }

        // 0. Validate input
        validateEmail(request.getEmail());
        validateRedirectUrl(request.getRedirectUrl(), request.getClientId(), realm);

        // 1. Find resource group and verify it's an organization
        GroupModel resourceGroup = findResourceGroup(realm, resourceId);
        if (resourceGroup == null) {
            throw new NotFoundException("Resource not found: " + resourceId);
        }

        String groupType = resourceGroup.getFirstAttribute(GROUP_TYPE_ATTRIBUTE);
        if (!RESOURCE_TYPE_ORGANIZATION.equals(groupType)) {
            throw new IllegalArgumentException("Invitations only supported for organization resources");
        }

        // 2. Get native organization
        OrganizationProvider orgProvider = session.getProvider(OrganizationProvider.class);
        if (orgProvider == null) {
            throw new Exception("OrganizationProvider not available");
        }

        OrganizationModel org = orgProvider.getByAlias(resourceId);
        if (org == null) {
            throw new NotFoundException("Native organization not found: " + resourceId);
        }

        // 3. Create invitation via Keycloak's native InvitationManager
        var invitationManager = orgProvider.getInvitationManager();
        var invitation = invitationManager.create(
            org,
            request.getEmail(),
            request.getFirstName(),
            request.getLastName()
        );

        log.infof("Created invitation for %s to organization %s", request.getEmail(), resourceId);

        // 4. Generate invite link and send email
        // Use redirectUrl and clientId from request if provided, otherwise use defaults
        String inviteLink = generateInviteLink(realm, org, resourceId, invitation.getId(), request);
        sendInvitationEmail(realm, org, invitation.getId(), inviteLink, request);

        return new InvitationResponse(
            invitation.getId(),
            invitation.getEmail(),
            invitation.getFirstName(),
            invitation.getLastName(),
            resourceId,
            "PENDING",
            invitation.getCreatedAt(),
            invitation.getExpiresAt(),
            inviteLink
        );
    }

    /**
     * Generates an invitation link using InviteOrgActionToken.
     * For new users, generates a registration link. For existing users, generates a login link.
     * After acceptance, users are redirected to the provided redirectUrl or default dashboard.
     *
     * @param realm The realm
     * @param org The organization being invited to
     * @param orgAlias The organization alias (used for default redirect URL)
     * @param invitationId The invitation ID
     * @param request The invitation request containing email, redirectUrl, and clientId
     * @return The invitation link URL
     */
    private String generateInviteLink(RealmModel realm, OrganizationModel org, String orgAlias,
                                      String invitationId, InvitationRequest request) {
        String email = request.getEmail();

        // Check if user already exists
        UserModel existingUser = session.users().getUserByEmail(realm, email);

        // Get token expiration (use admin action token lifespan)
        // Calculate absolute expiration time = current time + lifespan
        int lifespanSeconds = realm.getActionTokenGeneratedByAdminLifespan();
        int absoluteExpiration = Time.currentTime() + lifespanSeconds;

        // Determine client ID - use from request or default
        String clientId = request.getClientId();
        if (clientId == null || clientId.isEmpty()) {
            ClientModel dashboardClient = realm.getClientByClientId(DASHBOARD_CLIENT_ID);
            clientId = dashboardClient != null ? DASHBOARD_CLIENT_ID : Constants.ACCOUNT_MANAGEMENT_CLIENT_ID;
        }

        // Create the action token
        String userId = existingUser != null ? existingUser.getId() : invitationId;
        InviteOrgActionToken token = new InviteOrgActionToken(
            userId,
            absoluteExpiration,
            email,
            clientId
        );
        token.setOrgId(org.getId());
        // Set the token ID to match the invitation ID so Keycloak can look it up
        token.id(invitationId);

        // Determine redirect URI - use from request or build default
        String redirectUri = request.getRedirectUrl();
        if (redirectUri == null || redirectUri.isEmpty()) {
            // Build default redirect URI from dashboard client
            ClientModel dashboardClient = realm.getClientByClientId(clientId);
            redirectUri = buildDashboardRedirectUri(dashboardClient, orgAlias);
        }
        token.setRedirectUri(redirectUri);

        log.infof("Generated invite link with clientId=%s, redirectUri=%s", clientId, redirectUri);

        // Build the invite URL
        String tokenString = token.serialize(session, realm, session.getContext().getUri());

        if (existingUser != null) {
            // Existing user: use login actions service
            return LoginActionsService.actionTokenProcessor(session.getContext().getUri())
                .queryParam("key", tokenString)
                .build(realm.getName())
                .toString();
        } else {
            // New user: use registration link
            jakarta.ws.rs.core.UriBuilder registrationUrl = OIDCLoginProtocolService.registrationsUrl(
                session.getContext().getUri().getBaseUriBuilder());
            return registrationUrl
                .queryParam(OAuth2Constants.RESPONSE_TYPE, OAuth2Constants.CODE)
                .queryParam(OAuth2Constants.CLIENT_ID, clientId)
                .queryParam(Constants.TOKEN, tokenString)
                .build(realm.getName())
                .toString();
        }
    }

    /**
     * Builds the dashboard redirect URI with the organization selected.
     * Format: {dashboardBaseUrl}/?orgId={orgAlias}
     */
    private String buildDashboardRedirectUri(ClientModel dashboardClient, String orgAlias) {
        if (dashboardClient == null) {
            log.warnf("Dashboard client '%s' not found, using default redirect", DASHBOARD_CLIENT_ID);
            return null;
        }

        String baseUrl = dashboardClient.getBaseUrl();
        if (baseUrl == null || baseUrl.isEmpty()) {
            // Try root URL as fallback
            baseUrl = dashboardClient.getRootUrl();
        }

        if (baseUrl == null || baseUrl.isEmpty()) {
            // Try to extract base URL from valid redirect URIs
            var redirectUris = dashboardClient.getRedirectUris();
            if (redirectUris != null && !redirectUris.isEmpty()) {
                for (String uri : redirectUris) {
                    // Skip wildcard URIs and find a concrete one
                    if (uri != null && !uri.contains("*") && uri.startsWith("http")) {
                        // Extract base URL (remove trailing /* or path)
                        baseUrl = uri.replaceAll("/\\*$", "").replaceAll("/$", "");
                        // If it has a path, get just the origin
                        try {
                            java.net.URI parsed = new java.net.URI(baseUrl);
                            baseUrl = parsed.getScheme() + "://" + parsed.getHost();
                            if (parsed.getPort() != -1) {
                                baseUrl += ":" + parsed.getPort();
                            }
                        } catch (Exception e) {
                            // Keep the URL as-is
                        }
                        log.infof("Extracted base URL from redirect URIs: %s", baseUrl);
                        break;
                    }
                }
            }
        }

        if (baseUrl == null || baseUrl.isEmpty()) {
            log.warnf("Dashboard client has no base URL configured and no valid redirect URIs");
            return null;
        }

        // Remove trailing slash if present
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        // Build URL with orgId query parameter (URL-encoded for safety)
        String encodedOrgAlias;
        try {
            encodedOrgAlias = java.net.URLEncoder.encode(orgAlias, "UTF-8");
        } catch (java.io.UnsupportedEncodingException e) {
            encodedOrgAlias = orgAlias;
        }
        String redirectUri = baseUrl + "/?orgId=" + encodedOrgAlias;
        log.infof("Built dashboard redirect URI: %s", redirectUri);
        return redirectUri;
    }

    /**
     * Sends the invitation email to the user.
     * Creates a temporary user model for email sending if user doesn't exist.
     */
    private void sendInvitationEmail(RealmModel realm, OrganizationModel org,
                                     String invitationId, String inviteLink,
                                     InvitationRequest request) throws Exception {
        if (inviteLink == null || inviteLink.isEmpty()) {
            log.warnf("No invite link available for invitation %s, skipping email", invitationId);
            return;
        }

        // Check if user already exists
        UserModel user = session.users().getUserByEmail(realm, request.getEmail());

        if (user == null) {
            // Create a temporary lightweight user for email sending
            user = new org.keycloak.models.light.LightweightUserAdapter(session, realm, invitationId);
            user.setEmail(request.getEmail());
            user.setFirstName(request.getFirstName());
            user.setLastName(request.getLastName());
        }

        try {
            // Get action token lifespan in minutes for email template
            int lifespanSeconds = realm.getActionTokenGeneratedByAdminLifespan();
            long lifespanMinutes = TimeUnit.SECONDS.toMinutes(lifespanSeconds);

            session.getProvider(EmailTemplateProvider.class)
                .setRealm(realm)
                .setUser(user)
                .sendOrgInviteEmail(org, inviteLink, lifespanMinutes);

            log.infof("Sent invitation email to %s for organization %s", request.getEmail(), org.getName());
        } catch (EmailException e) {
            log.errorf(e, "Failed to send invitation email to %s", request.getEmail());
            throw new Exception("Failed to send invitation email: " + e.getMessage());
        }
    }

    /**
     * Lists pending invitations for an organization.
     *
     * @param resourceId Organization resource ID (alias)
     * @param first Number of invitations to return (pagination)
     * @param max Maximum number of invitations
     * @return List of InvitationResponse
     * @throws NotFoundException if resource or organization not found
     * @throws Exception if listing fails
     */
    public List<InvitationResponse> listInvitations(String resourceId, int first, int max) throws Exception {
        RealmModel realm = session.getContext().getRealm();
        if (realm == null) {
            throw new Exception("Could not get realm from session context");
        }

        GroupModel resourceGroup = findResourceGroup(realm, resourceId);
        if (resourceGroup == null) {
            throw new NotFoundException("Resource not found: " + resourceId);
        }

        OrganizationProvider orgProvider = session.getProvider(OrganizationProvider.class);
        if (orgProvider == null) {
            throw new Exception("OrganizationProvider not available");
        }

        OrganizationModel org = orgProvider.getByAlias(resourceId);
        if (org == null) {
            throw new NotFoundException("Native organization not found: " + resourceId);
        }

        var invitationManager = orgProvider.getInvitationManager();

        return invitationManager.getAllStream(org, Map.of(), first, max)
            .map(inv -> new InvitationResponse(
                inv.getId(),
                inv.getEmail(),
                inv.getFirstName(),
                inv.getLastName(),
                resourceId,
                inv.isExpired() ? "EXPIRED" : "PENDING",
                inv.getCreatedAt(),
                inv.getExpiresAt(),
                inv.getInviteLink()
            ))
            .collect(Collectors.toList());
    }

    /**
     * Deletes an invitation.
     *
     * @param resourceId Organization resource ID (for authorization context)
     * @param invitationId Invitation ID to delete
     * @throws Exception if deletion fails
     */
    public void deleteInvitation(String resourceId, String invitationId) throws Exception {
        OrganizationProvider orgProvider = session.getProvider(OrganizationProvider.class);
        if (orgProvider == null) {
            throw new Exception("OrganizationProvider not available");
        }

        var invitationManager = orgProvider.getInvitationManager();
        var invitation = invitationManager.getById(invitationId);
        if (invitation != null) {
            invitationManager.remove(invitationId);
            log.infof("Deleted invitation %s", invitationId);
        }
    }

    /**
     * Finds a resource group by ID (searches globally across all hierarchies).
     */
    private GroupModel findResourceGroup(RealmModel realm, String resourceId) {
        return session.groups()
            .searchForGroupByNameStream(realm, resourceId, true, 0, 1)
            .findFirst()
            .orElse(null);
    }

    /**
     * Validates email format and checks for malicious characters.
     *
     * @param email The email to validate
     * @throws IllegalArgumentException if email is invalid
     */
    private void validateEmail(String email) {
        if (email == null || email.isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }

        // Check for potentially malicious characters
        if (email.contains("<") || email.contains(">") || email.contains("\n") || email.contains("\r")) {
            throw new IllegalArgumentException("Email contains invalid characters");
        }

        // Validate email format
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new IllegalArgumentException("Invalid email format");
        }
    }

    /**
     * Validates redirect URL against the client's allowed redirect URIs.
     * This prevents open redirect vulnerabilities.
     *
     * @param redirectUrl The redirect URL to validate (can be null)
     * @param clientId The client ID to check against (uses default if null)
     * @param realm The realm to look up the client
     * @throws IllegalArgumentException if redirect URL is invalid
     */
    private void validateRedirectUrl(String redirectUrl, String clientId, RealmModel realm) {
        // If no redirect URL provided, it's valid (we'll use defaults)
        if (redirectUrl == null || redirectUrl.isEmpty()) {
            return;
        }

        // Validate URL format
        try {
            java.net.URI uri = new java.net.URI(redirectUrl);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equals("http") && !scheme.equals("https"))) {
                throw new IllegalArgumentException("Redirect URL must use http or https scheme");
            }
        } catch (java.net.URISyntaxException e) {
            throw new IllegalArgumentException("Invalid redirect URL format");
        }

        // Get the client to validate against
        String effectiveClientId = (clientId != null && !clientId.isEmpty()) ? clientId : DASHBOARD_CLIENT_ID;
        ClientModel client = realm.getClientByClientId(effectiveClientId);
        if (client == null) {
            // If client doesn't exist, we can't validate - reject the URL
            throw new IllegalArgumentException("Client not found for redirect URL validation");
        }

        // Check if redirect URL matches client's allowed redirect URIs
        Set<String> validUris = client.getRedirectUris();
        if (validUris == null || validUris.isEmpty()) {
            throw new IllegalArgumentException("Client has no valid redirect URIs configured");
        }

        boolean isValid = validUris.stream().anyMatch(validUri -> {
            if (validUri == null) {
                return false;
            }
            // Handle wildcard patterns
            if (validUri.endsWith("/*")) {
                String prefix = validUri.substring(0, validUri.length() - 1);
                return redirectUrl.startsWith(prefix);
            }
            if (validUri.endsWith("*")) {
                String prefix = validUri.substring(0, validUri.length() - 1);
                return redirectUrl.startsWith(prefix);
            }
            return redirectUrl.equals(validUri);
        });

        if (!isValid) {
            log.warnf("Redirect URL '%s' not in client's allowed redirect URIs", redirectUrl);
            throw new IllegalArgumentException("Redirect URL is not allowed for this client");
        }
    }
}
