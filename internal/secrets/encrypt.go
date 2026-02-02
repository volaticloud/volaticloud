package secrets

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
)

const encPrefix = "$vc_enc$"

// DefaultEncryptor is the singleton encryptor initialized at startup.
var DefaultEncryptor *Encryptor

// Init initializes the default encryptor with a base64-encoded 32-byte AES key.
// Returns an error if the key is invalid. If keyBase64 is empty, encryption is disabled.
func Init(keyBase64 string) error {
	if keyBase64 == "" {
		DefaultEncryptor = nil
		return nil
	}

	key, err := base64.StdEncoding.DecodeString(keyBase64)
	if err != nil {
		return fmt.Errorf("secrets: invalid base64 encryption key: %w", err)
	}
	if len(key) != 32 {
		return fmt.Errorf("secrets: encryption key must be 32 bytes (AES-256), got %d", len(key))
	}

	DefaultEncryptor = &Encryptor{key: key}
	return nil
}

// Enabled returns true if the default encryptor is initialized.
func Enabled() bool {
	return DefaultEncryptor != nil
}

// Encryptor performs AES-256-GCM encryption and decryption.
type Encryptor struct {
	key []byte
}

// Encrypt encrypts plaintext and returns "enc:<base64(nonce|ciphertext)>".
func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("secrets: cipher error: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("secrets: GCM error: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("secrets: nonce generation error: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return encPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts a value produced by Encrypt. Returns an error if the value
// is malformed or the key is wrong.
func (e *Encryptor) Decrypt(value string) (string, error) {
	if !strings.HasPrefix(value, encPrefix) {
		return "", fmt.Errorf("secrets: value does not have enc: prefix")
	}

	data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, encPrefix))
	if err != nil {
		return "", fmt.Errorf("secrets: invalid base64: %w", err)
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("secrets: cipher error: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("secrets: GCM error: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("secrets: ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("secrets: decryption failed: %w", err)
	}

	return string(plaintext), nil
}

// IsEncrypted returns true if the value has the "enc:" prefix.
func IsEncrypted(value string) bool {
	return strings.HasPrefix(value, encPrefix)
}
