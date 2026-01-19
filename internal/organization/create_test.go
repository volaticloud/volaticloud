package organization

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateTitle(t *testing.T) {
	tests := []struct {
		name    string
		title   string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid title",
			title:   "My Organization",
			wantErr: false,
		},
		{
			name:    "valid title with numbers",
			title:   "Organization 123",
			wantErr: false,
		},
		{
			name:    "valid title with special characters",
			title:   "My Org & Partners - 2024!",
			wantErr: false,
		},
		{
			name:    "empty title",
			title:   "",
			wantErr: true,
			errMsg:  "organization title is required",
		},
		{
			name:    "whitespace only title",
			title:   "   ",
			wantErr: true,
			errMsg:  "organization title is required",
		},
		{
			name:    "title at max length",
			title:   strings.Repeat("a", MaxTitleLength),
			wantErr: false,
		},
		{
			name:    "title exceeds max length",
			title:   strings.Repeat("a", MaxTitleLength+1),
			wantErr: true,
			errMsg:  "organization title must be 100 characters or less",
		},
		{
			name:    "title with control character (null)",
			title:   "My\x00Org",
			wantErr: true,
			errMsg:  "organization title contains invalid characters",
		},
		{
			name:    "title with control character (tab)",
			title:   "My\tOrg",
			wantErr: true,
			errMsg:  "organization title contains invalid characters",
		},
		{
			name:    "title with control character (newline)",
			title:   "My\nOrg",
			wantErr: true,
			errMsg:  "organization title contains invalid characters",
		},
		{
			name:    "title with DEL character",
			title:   "My\x7fOrg",
			wantErr: true,
			errMsg:  "organization title contains invalid characters",
		},
		{
			name:    "title with leading/trailing spaces (valid after trim)",
			title:   "  My Organization  ",
			wantErr: false,
		},
		{
			name:    "title with unicode characters",
			title:   "Организация",
			wantErr: false,
		},
		{
			name:    "title with emojis",
			title:   "My Org 🚀",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateTitle(tt.title)
			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateAlias(t *testing.T) {
	tests := []struct {
		name    string
		alias   string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid alias",
			alias:   "my-organization",
			wantErr: false,
		},
		{
			name:    "valid alias with numbers",
			alias:   "org-123",
			wantErr: false,
		},
		{
			name:    "valid alias numbers only",
			alias:   "123",
			wantErr: false,
		},
		{
			name:    "valid alias at min length",
			alias:   "abc",
			wantErr: false,
		},
		{
			name:    "valid single character alias",
			alias:   "a",
			wantErr: true,
			errMsg:  "organization alias must be at least 3 characters",
		},
		{
			name:    "valid two character alias",
			alias:   "ab",
			wantErr: true,
			errMsg:  "organization alias must be at least 3 characters",
		},
		{
			name:    "valid alias at max length",
			alias:   strings.Repeat("a", MaxAliasLength),
			wantErr: false,
		},
		{
			name:    "alias exceeds max length",
			alias:   strings.Repeat("a", MaxAliasLength+1),
			wantErr: true,
			errMsg:  "organization alias must be 50 characters or less",
		},
		{
			name:    "alias too short",
			alias:   "ab",
			wantErr: true,
			errMsg:  "organization alias must be at least 3 characters",
		},
		{
			name:    "empty alias",
			alias:   "",
			wantErr: true,
			errMsg:  "organization alias must be at least 3 characters",
		},
		{
			name:    "alias with uppercase",
			alias:   "My-Org",
			wantErr: true,
			errMsg:  "organization alias must be lowercase alphanumeric with hyphens",
		},
		{
			name:    "alias starting with hyphen",
			alias:   "-my-org",
			wantErr: true,
			errMsg:  "organization alias must be lowercase alphanumeric with hyphens",
		},
		{
			name:    "alias ending with hyphen",
			alias:   "my-org-",
			wantErr: true,
			errMsg:  "organization alias must be lowercase alphanumeric with hyphens",
		},
		{
			name:    "alias with consecutive hyphens",
			alias:   "my--org",
			wantErr: true,
			errMsg:  "organization alias cannot contain consecutive hyphens",
		},
		{
			name:    "alias with spaces",
			alias:   "my org",
			wantErr: true,
			errMsg:  "organization alias must be lowercase alphanumeric with hyphens",
		},
		{
			name:    "alias with underscore",
			alias:   "my_org",
			wantErr: true,
			errMsg:  "organization alias must be lowercase alphanumeric with hyphens",
		},
		{
			name:    "alias with special characters",
			alias:   "my@org",
			wantErr: true,
			errMsg:  "organization alias must be lowercase alphanumeric with hyphens",
		},
		{
			name:    "alias with period",
			alias:   "my.org",
			wantErr: true,
			errMsg:  "organization alias must be lowercase alphanumeric with hyphens",
		},
		// Security: directory traversal prevention
		{
			name:    "alias with forward slash",
			alias:   "my/org",
			wantErr: true,
			errMsg:  "organization alias contains invalid path characters",
		},
		{
			name:    "alias with backslash",
			alias:   "my\\org",
			wantErr: true,
			errMsg:  "organization alias contains invalid path characters",
		},
		{
			name:    "alias is single dot",
			alias:   ".",
			wantErr: true,
			errMsg:  "organization alias must be at least 3 characters", // Length check happens first
		},
		{
			name:    "alias is double dot",
			alias:   "..",
			wantErr: true,
			errMsg:  "organization alias must be at least 3 characters", // Length check happens first
		},
		{
			name:    "alias starting with dot",
			alias:   ".hidden",
			wantErr: true,
			errMsg:  "organization alias cannot start with a dot",
		},
		{
			name:    "alias with path traversal sequence",
			alias:   "../admin",
			wantErr: true,
			errMsg:  "organization alias contains invalid path characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAlias(tt.alias)
			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGenerateAliasFromTitle(t *testing.T) {
	tests := []struct {
		name     string
		title    string
		expected string
	}{
		{
			name:     "simple title",
			title:    "My Organization",
			expected: "my-organization",
		},
		{
			name:     "title with numbers",
			title:    "Organization 123",
			expected: "organization-123",
		},
		{
			name:     "title with multiple spaces",
			title:    "My   Organization",
			expected: "my-organization",
		},
		{
			name:     "title with special characters",
			title:    "My Org & Partners!",
			expected: "my-org-partners",
		},
		{
			name:     "title with leading/trailing spaces",
			title:    "  My Organization  ",
			expected: "my-organization",
		},
		{
			name:     "title with accents (diacritics)",
			title:    "Café Résumé",
			expected: "cafe-resume",
		},
		{
			name:     "title with German umlauts",
			title:    "München Büro",
			expected: "munchen-buro",
		},
		{
			name:     "title starting with special char",
			title:    "!My Organization",
			expected: "my-organization",
		},
		{
			name:     "title ending with special char",
			title:    "My Organization!",
			expected: "my-organization",
		},
		{
			name:     "all uppercase",
			title:    "MY ORGANIZATION",
			expected: "my-organization",
		},
		{
			name:     "mixed case",
			title:    "MyOrganization",
			expected: "myorganization",
		},
		{
			name:     "numbers only",
			title:    "123",
			expected: "123",
		},
		{
			name:     "title with hyphens",
			title:    "My-Organization",
			expected: "my-organization",
		},
		{
			name:     "title with underscores",
			title:    "My_Organization",
			expected: "my-organization",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateAliasFromTitle(tt.title)
			assert.Equal(t, tt.expected, result)
			// Also verify the generated alias passes validation
			err := ValidateAlias(result)
			assert.NoError(t, err, "generated alias should pass validation")
		})
	}
}

func TestGenerateAliasFromTitle_Truncation(t *testing.T) {
	// Test that long titles are properly truncated
	longTitle := strings.Repeat("organization ", 10) // ~130 characters
	alias := GenerateAliasFromTitle(longTitle)

	assert.LessOrEqual(t, len(alias), MaxAliasLength, "alias should not exceed max length")
	assert.False(t, strings.HasSuffix(alias, "-"), "alias should not end with hyphen after truncation")
	assert.NoError(t, ValidateAlias(alias), "truncated alias should pass validation")
}

func TestGenerateAliasFromTitle_Fallback(t *testing.T) {
	tests := []struct {
		name  string
		title string
	}{
		{
			name:  "empty title",
			title: "",
		},
		{
			name:  "whitespace only",
			title: "   ",
		},
		{
			name:  "special characters only",
			title: "!@#$%",
		},
		{
			name:  "single character",
			title: "a",
		},
		{
			name:  "two characters",
			title: "ab",
		},
		{
			name:  "emojis only",
			title: "🚀🌟",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			alias := GenerateAliasFromTitle(tt.title)
			assert.True(t, strings.HasPrefix(alias, "org-"), "fallback alias should start with 'org-'")
			assert.GreaterOrEqual(t, len(alias), MinAliasLength, "fallback alias should meet min length")
			assert.NoError(t, ValidateAlias(alias), "fallback alias should pass validation")
		})
	}
}

func TestGenerateAliasFromTitle_Unicode(t *testing.T) {
	tests := []struct {
		name     string
		title    string
		expected string
	}{
		{
			name:     "French accents",
			title:    "Société Générale",
			expected: "societe-generale",
		},
		{
			name:     "Spanish tilde",
			title:    "España Organización",
			expected: "espana-organizacion",
		},
		{
			name:     "Nordic characters",
			title:    "Ørsted Ångström",
			expected: "rsted-angstrom",
		},
		{
			name:     "Polish characters",
			title:    "Łódź Firma",
			expected: "odz-firma",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateAliasFromTitle(tt.title)
			assert.Equal(t, tt.expected, result)
			assert.NoError(t, ValidateAlias(result), "unicode-derived alias should pass validation")
		})
	}
}

func TestConstants(t *testing.T) {
	// Verify constants have expected values
	assert.Equal(t, 100, MaxTitleLength, "MaxTitleLength should be 100")
	assert.Equal(t, 3, MinAliasLength, "MinAliasLength should be 3")
	assert.Equal(t, 50, MaxAliasLength, "MaxAliasLength should be 50")
	assert.Equal(t, "organization", ResourceTypeOrganization, "ResourceTypeOrganization should be 'organization'")
}
