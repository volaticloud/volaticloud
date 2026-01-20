package authz

import (
	"errors"
	"testing"
)

func TestGetScopesForType(t *testing.T) {
	tests := []struct {
		name         string
		resourceType ResourceType
		wantLen      int
		wantContains string
	}{
		{
			name:         "Strategy scopes",
			resourceType: ResourceTypeStrategy,
			wantLen:      12, // view, edit, delete, run-backtest, stop-backtest, delete-backtest, make-public, view-users + 4 alert scopes
			wantContains: "run-backtest",
		},
		{
			name:         "Bot scopes",
			resourceType: ResourceTypeBot,
			wantLen:      13, // view, view-secrets, run, stop, delete, edit, freqtrade-api, make-public, view-users + 4 alert scopes
			wantContains: "freqtrade-api",
		},
		{
			name:         "Exchange scopes",
			resourceType: ResourceTypeExchange,
			wantLen:      5, // view, view-secrets, edit, delete, view-users
			wantContains: "view-secrets",
		},
		{
			name:         "BotRunner scopes",
			resourceType: ResourceTypeBotRunner,
			wantLen:      10, // view, view-secrets, edit, delete, make-public, view-users + 4 alert scopes
			wantContains: "make-public",
		},
		{
			name:         "Group scopes",
			resourceType: ResourceTypeGroup,
			wantLen:      15, // view, edit, delete, mark-alert-as-read, view-users, invite-user, change-user-roles + 4 create scopes + 4 alert scopes
			wantContains: "mark-alert-as-read",
		},
		{
			name:         "Group scopes include invite-user",
			resourceType: ResourceTypeGroup,
			wantLen:      15,
			wantContains: "invite-user",
		},
		{
			name:         "Group scopes include change-user-roles",
			resourceType: ResourceTypeGroup,
			wantLen:      15,
			wantContains: "change-user-roles",
		},
		{
			name:         "Unknown type returns nil",
			resourceType: ResourceType("unknown"),
			wantLen:      0,
			wantContains: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GetScopesForType(tt.resourceType)
			if len(got) != tt.wantLen {
				t.Errorf("GetScopesForType() returned %d scopes, want %d", len(got), tt.wantLen)
			}
			if tt.wantContains != "" {
				found := false
				for _, scope := range got {
					if scope == tt.wantContains {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("GetScopesForType() missing expected scope %q", tt.wantContains)
				}
			}
		})
	}
}

func TestIsInvalidScopeError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "nil error returns false",
			err:  nil,
			want: false,
		},
		{
			name: "invalid_scope error returns true",
			err:  errors.New("400 Bad Request: invalid_scope: One of the given scopes [mark-alert-as-read] is invalid"),
			want: true,
		},
		{
			name: "invalid scope (with space) error returns true",
			err:  errors.New("invalid scope: some-scope"),
			want: true,
		},
		{
			name: "invalid_resource error returns true",
			err:  errors.New("400 Bad Request: invalid_resource: Resource with id [abc] does not exist."),
			want: true,
		},
		{
			name: "resource does not exist error returns true",
			err:  errors.New("Resource with id [abc-123] does not exist."),
			want: true,
		},
		{
			name: "other error returns false",
			err:  errors.New("connection refused"),
			want: false,
		},
		{
			name: "permission denied error returns false",
			err:  errors.New("permission denied"),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsInvalidScopeError(tt.err); got != tt.want {
				t.Errorf("IsInvalidScopeError() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestShouldTriggerSelfHealing(t *testing.T) {
	tests := []struct {
		name          string
		hasPermission bool
		err           error
		want          bool
	}{
		{
			name:          "has permission - no self-healing",
			hasPermission: true,
			err:           nil,
			want:          false,
		},
		{
			name:          "no permission, no error - trigger self-healing",
			hasPermission: false,
			err:           nil,
			want:          true,
		},
		{
			name:          "no permission, invalid_scope error - trigger self-healing",
			hasPermission: false,
			err:           errors.New("invalid_scope: some-scope"),
			want:          true,
		},
		{
			name:          "no permission, other error - no self-healing",
			hasPermission: false,
			err:           errors.New("network error"),
			want:          false,
		},
		{
			name:          "has permission with error - no self-healing",
			hasPermission: true,
			err:           errors.New("some warning"),
			want:          false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ShouldTriggerSelfHealing(tt.hasPermission, tt.err); got != tt.want {
				t.Errorf("ShouldTriggerSelfHealing() = %v, want %v", got, tt.want)
			}
		})
	}
}
