package keycloak

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"volaticloud/internal/auth"
)

// mockKeycloakServer creates a test server that simulates Keycloak responses
func mockKeycloakServer(t *testing.T, handlers map[string]http.HandlerFunc) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle token endpoint for all requests
		if strings.Contains(r.URL.Path, "/protocol/openid-connect/token") {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token": "mock-token",
				"token_type":   "Bearer",
				"expires_in":   300,
			})
			return
		}

		// Find matching handler
		for pattern, handler := range handlers {
			if strings.Contains(r.URL.Path, pattern) {
				handler(w, r)
				return
			}
		}

		// Default 404
		http.NotFound(w, r)
	}))
}

func TestCreateInvitation(t *testing.T) {
	tests := []struct {
		name        string
		resourceID  string
		request     InvitationRequest
		mockHandler http.HandlerFunc
		wantErr     bool
		errContains string
		validate    func(t *testing.T, resp *InvitationResponse)
	}{
		{
			name:       "successful invitation creation",
			resourceID: "org-123",
			request: InvitationRequest{
				Email:     "newuser@example.com",
				FirstName: "John",
				LastName:  "Doe",
			},
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "POST", r.Method)
				assert.Contains(t, r.URL.Path, "/invitations")

				// Verify request body
				var req InvitationRequest
				json.NewDecoder(r.Body).Decode(&req)
				assert.Equal(t, "newuser@example.com", req.Email)
				assert.Equal(t, "John", req.FirstName)

				w.WriteHeader(http.StatusCreated)
				json.NewEncoder(w).Encode(InvitationResponse{
					ID:         "inv-uuid-123",
					Email:      "newuser@example.com",
					FirstName:  "John",
					LastName:   "Doe",
					ResourceID: "org-123",
					Status:     "PENDING",
					CreatedAt:  1704067200000,
					ExpiresAt:  1704672000000,
					InviteLink: "https://keycloak.example.com/invite/abc123",
				})
			},
			wantErr: false,
			validate: func(t *testing.T, resp *InvitationResponse) {
				assert.Equal(t, "inv-uuid-123", resp.ID)
				assert.Equal(t, "newuser@example.com", resp.Email)
				assert.Equal(t, "PENDING", resp.Status)
				assert.NotEmpty(t, resp.InviteLink)
			},
		},
		{
			name:       "invitation with minimal fields",
			resourceID: "org-456",
			request: InvitationRequest{
				Email: "minimal@example.com",
			},
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusCreated)
				json.NewEncoder(w).Encode(InvitationResponse{
					ID:         "inv-uuid-456",
					Email:      "minimal@example.com",
					ResourceID: "org-456",
					Status:     "PENDING",
				})
			},
			wantErr: false,
			validate: func(t *testing.T, resp *InvitationResponse) {
				assert.Equal(t, "minimal@example.com", resp.Email)
				assert.Empty(t, resp.FirstName)
				assert.Empty(t, resp.LastName)
			},
		},
		{
			name:       "duplicate invitation error",
			resourceID: "org-123",
			request: InvitationRequest{
				Email: "existing@example.com",
			},
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusConflict)
				w.Write([]byte(`{"error": "User already invited to this organization"}`))
			},
			wantErr:     true,
			errContains: "already invited",
		},
		{
			name:       "organization not found",
			resourceID: "nonexistent-org",
			request: InvitationRequest{
				Email: "user@example.com",
			},
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNotFound)
				w.Write([]byte(`{"error": "Resource not found"}`))
			},
			wantErr:     true,
			errContains: "status 404",
		},
		{
			name:       "invalid email format rejected",
			resourceID: "org-123",
			request: InvitationRequest{
				Email: "invalid-email",
			},
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte(`{"error": "Invalid email format"}`))
			},
			wantErr:     true,
			errContains: "status 400",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := mockKeycloakServer(t, map[string]http.HandlerFunc{
				"/invitations": tt.mockHandler,
			})
			defer server.Close()

			client := NewAdminClient(auth.KeycloakConfig{
				URL:          server.URL,
				Realm:        "test-realm",
				ClientID:     "test-client",
				ClientSecret: "test-secret",
			})

			resp, err := client.CreateInvitation(context.Background(), tt.resourceID, tt.request)

			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				return
			}

			require.NoError(t, err)
			require.NotNil(t, resp)
			if tt.validate != nil {
				tt.validate(t, resp)
			}
		})
	}
}

func TestListInvitations(t *testing.T) {
	tests := []struct {
		name        string
		resourceID  string
		first       int
		max         int
		mockHandler http.HandlerFunc
		wantErr     bool
		errContains string
		validate    func(t *testing.T, resp *InvitationListResponse)
	}{
		{
			name:       "list invitations successfully",
			resourceID: "org-123",
			first:      0,
			max:        20,
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "GET", r.Method)
				assert.Equal(t, "0", r.URL.Query().Get("first"))
				assert.Equal(t, "20", r.URL.Query().Get("max"))

				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(InvitationListResponse{
					Invitations: []InvitationResponse{
						{
							ID:         "inv-1",
							Email:      "user1@example.com",
							Status:     "PENDING",
							ResourceID: "org-123",
						},
						{
							ID:         "inv-2",
							Email:      "user2@example.com",
							Status:     "PENDING",
							ResourceID: "org-123",
						},
					},
					Total: 2,
				})
			},
			wantErr: false,
			validate: func(t *testing.T, resp *InvitationListResponse) {
				assert.Equal(t, 2, resp.Total)
				assert.Len(t, resp.Invitations, 2)
				assert.Equal(t, "user1@example.com", resp.Invitations[0].Email)
				assert.Equal(t, "user2@example.com", resp.Invitations[1].Email)
			},
		},
		{
			name:       "empty invitation list",
			resourceID: "org-empty",
			first:      0,
			max:        20,
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(InvitationListResponse{
					Invitations: []InvitationResponse{},
					Total:       0,
				})
			},
			wantErr: false,
			validate: func(t *testing.T, resp *InvitationListResponse) {
				assert.Equal(t, 0, resp.Total)
				assert.Empty(t, resp.Invitations)
			},
		},
		{
			name:       "pagination parameters",
			resourceID: "org-123",
			first:      10,
			max:        5,
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "10", r.URL.Query().Get("first"))
				assert.Equal(t, "5", r.URL.Query().Get("max"))

				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(InvitationListResponse{
					Invitations: []InvitationResponse{},
					Total:       0,
				})
			},
			wantErr: false,
		},
		{
			name:       "organization not found",
			resourceID: "nonexistent",
			first:      0,
			max:        20,
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNotFound)
				w.Write([]byte(`{"error": "Resource not found"}`))
			},
			wantErr:     true,
			errContains: "status 404",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := mockKeycloakServer(t, map[string]http.HandlerFunc{
				"/invitations": tt.mockHandler,
			})
			defer server.Close()

			client := NewAdminClient(auth.KeycloakConfig{
				URL:          server.URL,
				Realm:        "test-realm",
				ClientID:     "test-client",
				ClientSecret: "test-secret",
			})

			resp, err := client.ListInvitations(context.Background(), tt.resourceID, tt.first, tt.max)

			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				return
			}

			require.NoError(t, err)
			require.NotNil(t, resp)
			if tt.validate != nil {
				tt.validate(t, resp)
			}
		})
	}
}

func TestDeleteInvitation(t *testing.T) {
	tests := []struct {
		name         string
		resourceID   string
		invitationID string
		mockHandler  http.HandlerFunc
		wantErr      bool
		errContains  string
	}{
		{
			name:         "delete invitation successfully (204)",
			resourceID:   "org-123",
			invitationID: "inv-uuid-123",
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "DELETE", r.Method)
				assert.Contains(t, r.URL.Path, "/inv-uuid-123")
				w.WriteHeader(http.StatusNoContent)
			},
			wantErr: false,
		},
		{
			name:         "delete invitation successfully (200)",
			resourceID:   "org-123",
			invitationID: "inv-uuid-456",
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			},
			wantErr: false,
		},
		{
			name:         "invitation not found",
			resourceID:   "org-123",
			invitationID: "nonexistent-inv",
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNotFound)
				w.Write([]byte(`{"error": "Invitation not found"}`))
			},
			wantErr:     true,
			errContains: "status 404",
		},
		{
			name:         "organization not found",
			resourceID:   "nonexistent-org",
			invitationID: "inv-123",
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNotFound)
				w.Write([]byte(`{"error": "Resource not found"}`))
			},
			wantErr:     true,
			errContains: "status 404",
		},
		{
			name:         "unauthorized",
			resourceID:   "org-123",
			invitationID: "inv-123",
			mockHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusForbidden)
				w.Write([]byte(`{"error": "Insufficient permissions"}`))
			},
			wantErr:     true,
			errContains: "status 403",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := mockKeycloakServer(t, map[string]http.HandlerFunc{
				"/invitations": tt.mockHandler,
			})
			defer server.Close()

			client := NewAdminClient(auth.KeycloakConfig{
				URL:          server.URL,
				Realm:        "test-realm",
				ClientID:     "test-client",
				ClientSecret: "test-secret",
			})

			err := client.DeleteInvitation(context.Background(), tt.resourceID, tt.invitationID)

			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				return
			}

			require.NoError(t, err)
		})
	}
}

func TestInvitationRequestValidation(t *testing.T) {
	// Test that InvitationRequest struct properly marshals/unmarshals
	tests := []struct {
		name    string
		request InvitationRequest
		json    string
	}{
		{
			name: "full request",
			request: InvitationRequest{
				Email:       "user@example.com",
				FirstName:   "John",
				LastName:    "Doe",
				RedirectURL: "https://app.example.com",
				ClientID:    "dashboard",
			},
		},
		{
			name: "minimal request",
			request: InvitationRequest{
				Email: "user@example.com",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Marshal
			data, err := json.Marshal(tt.request)
			require.NoError(t, err)

			// Unmarshal
			var decoded InvitationRequest
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, tt.request.Email, decoded.Email)
			assert.Equal(t, tt.request.FirstName, decoded.FirstName)
			assert.Equal(t, tt.request.LastName, decoded.LastName)
			assert.Equal(t, tt.request.RedirectURL, decoded.RedirectURL)
			assert.Equal(t, tt.request.ClientID, decoded.ClientID)
		})
	}
}

func TestInvitationResponseValidation(t *testing.T) {
	// Test that InvitationResponse struct properly unmarshals from JSON
	jsonData := `{
		"id": "inv-123",
		"email": "user@example.com",
		"firstName": "John",
		"lastName": "Doe",
		"resourceId": "org-456",
		"status": "PENDING",
		"createdAt": 1704067200000,
		"expiresAt": 1704672000000,
		"inviteLink": "https://keycloak.example.com/invite/abc"
	}`

	var resp InvitationResponse
	err := json.Unmarshal([]byte(jsonData), &resp)
	require.NoError(t, err)

	assert.Equal(t, "inv-123", resp.ID)
	assert.Equal(t, "user@example.com", resp.Email)
	assert.Equal(t, "John", resp.FirstName)
	assert.Equal(t, "Doe", resp.LastName)
	assert.Equal(t, "org-456", resp.ResourceID)
	assert.Equal(t, "PENDING", resp.Status)
	assert.Equal(t, int64(1704067200000), resp.CreatedAt)
	assert.Equal(t, int64(1704672000000), resp.ExpiresAt)
	assert.Equal(t, "https://keycloak.example.com/invite/abc", resp.InviteLink)
}

func TestGetDashboardClientID(t *testing.T) {
	tests := []struct {
		name     string
		config   auth.KeycloakConfig
		expected string
	}{
		{
			name: "uses configured client ID",
			config: auth.KeycloakConfig{
				DashboardClientID: "custom-dashboard",
			},
			expected: "custom-dashboard",
		},
		{
			name:     "uses default when not configured",
			config:   auth.KeycloakConfig{},
			expected: "dashboard",
		},
		{
			name: "uses default for empty string",
			config: auth.KeycloakConfig{
				DashboardClientID: "",
			},
			expected: "dashboard",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewAdminClient(tt.config)
			assert.Equal(t, tt.expected, client.GetDashboardClientID())
		})
	}
}

func TestChangeUserRole(t *testing.T) {
	tests := []struct {
		name          string
		resourceID    string
		userID        string
		newRole       string
		removeHandler http.HandlerFunc
		addHandler    http.HandlerFunc
		wantErr       bool
		errContains   string
		validate      func(t *testing.T, resp *ChangeUserRoleResponse)
	}{
		{
			name:       "successful role change",
			resourceID: "org-123",
			userID:     "user-456",
			newRole:    "admin",
			removeHandler: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "DELETE", r.Method)
				assert.Contains(t, r.URL.Path, "/user-456")
				w.WriteHeader(http.StatusNoContent)
			},
			addHandler: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "POST", r.Method)

				var req ChangeUserRoleRequest
				json.NewDecoder(r.Body).Decode(&req)
				assert.Equal(t, "user-456", req.UserID)
				assert.Equal(t, "admin", req.NewRole)

				w.WriteHeader(http.StatusCreated)
				json.NewEncoder(w).Encode(ChangeUserRoleResponse{
					UserID:     "user-456",
					ResourceID: "org-123",
					Role:       "admin",
					AddedToOrg: false,
				})
			},
			wantErr: false,
			validate: func(t *testing.T, resp *ChangeUserRoleResponse) {
				assert.Equal(t, "user-456", resp.UserID)
				assert.Equal(t, "org-123", resp.ResourceID)
				assert.Equal(t, "admin", resp.Role)
			},
		},
		{
			name:       "role change with 404 on remove (user has no roles yet)",
			resourceID: "org-123",
			userID:     "new-user",
			newRole:    "viewer",
			removeHandler: func(w http.ResponseWriter, r *http.Request) {
				// 404 is acceptable - user might not have roles
				w.WriteHeader(http.StatusNotFound)
			},
			addHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusCreated)
				json.NewEncoder(w).Encode(ChangeUserRoleResponse{
					UserID:     "new-user",
					ResourceID: "org-123",
					Role:       "viewer",
				})
			},
			wantErr: false,
			validate: func(t *testing.T, resp *ChangeUserRoleResponse) {
				assert.Equal(t, "viewer", resp.Role)
			},
		},
		{
			name:       "user not found on add",
			resourceID: "org-123",
			userID:     "nonexistent-user",
			newRole:    "viewer",
			removeHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			},
			addHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNotFound)
				w.Write([]byte(`{"error": "User not found"}`))
			},
			wantErr:     true,
			errContains: "status 404",
		},
		{
			name:       "organization not found on add",
			resourceID: "nonexistent-org",
			userID:     "user-123",
			newRole:    "admin",
			removeHandler: func(w http.ResponseWriter, r *http.Request) {
				// Remove succeeds (or returns 404 which is OK)
				w.WriteHeader(http.StatusNoContent)
			},
			addHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNotFound)
				w.Write([]byte(`{"error": "Resource not found"}`))
			},
			wantErr:     true,
			errContains: "status 404",
		},
		{
			name:       "forbidden",
			resourceID: "org-123",
			userID:     "user-456",
			newRole:    "owner",
			removeHandler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusForbidden)
				w.Write([]byte(`{"error": "Insufficient permissions"}`))
			},
			addHandler:  nil,
			wantErr:     true,
			errContains: "status 403",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requestCount := 0
			server := mockKeycloakServer(t, map[string]http.HandlerFunc{
				"/members": func(w http.ResponseWriter, r *http.Request) {
					requestCount++
					// First request is DELETE (remove), second is POST (add)
					if r.Method == "DELETE" {
						if tt.removeHandler != nil {
							tt.removeHandler(w, r)
						}
					} else if r.Method == "POST" {
						if tt.addHandler != nil {
							tt.addHandler(w, r)
						}
					}
				},
			})
			defer server.Close()

			client := NewAdminClient(auth.KeycloakConfig{
				URL:          server.URL,
				Realm:        "test-realm",
				ClientID:     "test-client",
				ClientSecret: "test-secret",
			})

			resp, err := client.ChangeUserRole(context.Background(), tt.resourceID, tt.userID, tt.newRole)

			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				return
			}

			require.NoError(t, err)
			require.NotNil(t, resp)
			if tt.validate != nil {
				tt.validate(t, resp)
			}
		})
	}
}

func TestChangeUserRoleRequestValidation(t *testing.T) {
	// Test that ChangeUserRoleRequest struct properly marshals
	tests := []struct {
		name    string
		request ChangeUserRoleRequest
	}{
		{
			name: "full request",
			request: ChangeUserRoleRequest{
				UserID:  "user-123",
				NewRole: "admin",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.request)
			require.NoError(t, err)

			var decoded ChangeUserRoleRequest
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, tt.request.UserID, decoded.UserID)
			assert.Equal(t, tt.request.NewRole, decoded.NewRole)
		})
	}
}
