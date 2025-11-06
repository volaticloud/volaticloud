package utils

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGenerateSecureUsername(t *testing.T) {
	tests := []struct {
		name      string
		wantCount int
	}{
		{
			name:      "generates unique usernames",
			wantCount: 100,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usernames := make(map[string]bool)
			for i := 0; i < tt.wantCount; i++ {
				username, err := GenerateSecureUsername()

				// Should not error
				assert.NoError(t, err)

				// Should not be empty
				assert.NotEmpty(t, username)

				// Should start with "admin_"
				assert.True(t, strings.HasPrefix(username, "admin_"), "Username should start with admin_")

				// Should have correct format length (admin_ = 6 chars + 8 random = 14 total)
				assert.Equal(t, 6+UsernameRandomLength, len(username))

				// Random part should only contain alphanumeric characters
				randomPart := strings.TrimPrefix(username, "admin_")
				for _, char := range randomPart {
					assert.True(t, isAlphanumeric(char), "Character %c should be alphanumeric", char)
				}

				// Should be unique
				assert.False(t, usernames[username], "Username should be unique: %s", username)
				usernames[username] = true
			}

			// All usernames should be unique
			assert.Equal(t, tt.wantCount, len(usernames))
		})
	}
}

func TestGenerateSecurePassword(t *testing.T) {
	tests := []struct {
		name      string
		wantCount int
	}{
		{
			name:      "generates unique passwords",
			wantCount: 100,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			passwords := make(map[string]bool)
			for i := 0; i < tt.wantCount; i++ {
				password, err := GenerateSecurePassword()

				// Should not error
				assert.NoError(t, err)

				// Should not be empty
				assert.NotEmpty(t, password)

				// Should have correct length
				assert.Equal(t, PasswordLength, len(password))

				// Should only contain alphanumeric characters
				for _, char := range password {
					assert.True(t, isAlphanumeric(char), "Character %c should be alphanumeric", char)
				}

				// Should be unique (collision extremely unlikely with 32 chars from 62-char set)
				assert.False(t, passwords[password], "Password should be unique: %s", password)
				passwords[password] = true
			}

			// All passwords should be unique
			assert.Equal(t, tt.wantCount, len(passwords))
		})
	}
}

func TestGenerateRandomString(t *testing.T) {
	tests := []struct {
		name     string
		length   int
		charset  string
		wantErr  bool
		errMsg   string
		validate func(t *testing.T, result string)
	}{
		{
			name:    "valid length and charset",
			length:  10,
			charset: "abc",
			wantErr: false,
			validate: func(t *testing.T, result string) {
				assert.Equal(t, 10, len(result))
				for _, char := range result {
					assert.Contains(t, "abc", string(char))
				}
			},
		},
		{
			name:    "zero length",
			length:  0,
			charset: "abc",
			wantErr: true,
			errMsg:  "length must be positive",
		},
		{
			name:    "negative length",
			length:  -5,
			charset: "abc",
			wantErr: true,
			errMsg:  "length must be positive",
		},
		{
			name:    "empty charset",
			length:  10,
			charset: "",
			wantErr: true,
			errMsg:  "charset cannot be empty",
		},
		{
			name:    "single character charset",
			length:  20,
			charset: "x",
			wantErr: false,
			validate: func(t *testing.T, result string) {
				assert.Equal(t, 20, len(result))
				assert.Equal(t, "xxxxxxxxxxxxxxxxxxxx", result)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := generateRandomString(tt.length, tt.charset)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				if tt.validate != nil {
					tt.validate(t, result)
				}
			}
		})
	}
}

func TestGenerateSecureToken(t *testing.T) {
	tests := []struct {
		name    string
		length  int
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid length",
			length:  32,
			wantErr: false,
		},
		{
			name:    "zero length",
			length:  0,
			wantErr: true,
			errMsg:  "length must be positive",
		},
		{
			name:    "negative length",
			length:  -10,
			wantErr: true,
			errMsg:  "length must be positive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := GenerateSecureToken(tt.length)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, token)
				// Base64 encoding increases length, so just check it's not empty
				// and contains valid base64 URL-safe characters
				assert.Regexp(t, `^[A-Za-z0-9_-]+$`, token)
			}
		})
	}

	// Test uniqueness
	t.Run("generates unique tokens", func(t *testing.T) {
		tokens := make(map[string]bool)
		for i := 0; i < 100; i++ {
			token, err := GenerateSecureToken(32)
			assert.NoError(t, err)
			assert.False(t, tokens[token], "Token should be unique")
			tokens[token] = true
		}
		assert.Equal(t, 100, len(tokens))
	})
}

// Helper function to check if a character is alphanumeric
func isAlphanumeric(char rune) bool {
	return (char >= 'a' && char <= 'z') ||
		(char >= 'A' && char <= 'Z') ||
		(char >= '0' && char <= '9')
}
