package utils

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

const (
	// UsernameRandomLength is the length of the random suffix for usernames
	UsernameRandomLength = 8
	// PasswordLength is the length of generated passwords
	PasswordLength = 32
	// Alphanumeric characters for generating credentials
	alphanumeric = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
)

// GenerateSecureUsername generates a secure username with format: admin_<8-random-chars>
func GenerateSecureUsername() (string, error) {
	randomSuffix, err := generateRandomString(UsernameRandomLength, alphanumeric)
	if err != nil {
		return "", fmt.Errorf("failed to generate username: %w", err)
	}
	return "admin_" + randomSuffix, nil
}

// GenerateSecurePassword generates a 32-character random alphanumeric password
func GenerateSecurePassword() (string, error) {
	password, err := generateRandomString(PasswordLength, alphanumeric)
	if err != nil {
		return "", fmt.Errorf("failed to generate password: %w", err)
	}
	return password, nil
}

// generateRandomString generates a random string of specified length using given charset
func generateRandomString(length int, charset string) (string, error) {
	if length <= 0 {
		return "", fmt.Errorf("length must be positive")
	}
	if len(charset) == 0 {
		return "", fmt.Errorf("charset cannot be empty")
	}

	// Create byte slice for random data
	randomBytes := make([]byte, length)

	// Generate random indices into charset
	for i := 0; i < length; i++ {
		// Generate a random byte
		randomByte := make([]byte, 1)
		if _, err := rand.Read(randomByte); err != nil {
			return "", fmt.Errorf("failed to read random data: %w", err)
		}

		// Map random byte to charset index
		// Use modulo to ensure index is within charset bounds
		idx := int(randomByte[0]) % len(charset)
		randomBytes[i] = charset[idx]
	}

	return string(randomBytes), nil
}

// GenerateSecureToken generates a cryptographically secure random token
// encoded as base64. This can be used for API tokens, session IDs, etc.
func GenerateSecureToken(length int) (string, error) {
	if length <= 0 {
		return "", fmt.Errorf("length must be positive")
	}

	// Generate random bytes
	tokenBytes := make([]byte, length)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}

	// Encode as base64 URL-safe (no padding)
	return base64.RawURLEncoding.EncodeToString(tokenBytes), nil
}
