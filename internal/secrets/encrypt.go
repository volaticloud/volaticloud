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

const (
	encPrefix   = "$vc_enc$"
	encV1Prefix = "$vc_enc$v1$"
)

// DefaultEncryptor is the singleton encryptor initialized at startup.
var DefaultEncryptor *Encryptor

// Init initializes the default encryptor with a base64-encoded 32-byte AES key.
// Additional old keys can be provided for key rotation — they will be tried
// during decryption if the primary key fails.
// Returns an error if any key is invalid. If currentKeyBase64 is empty, encryption is disabled.
func Init(currentKeyBase64 string, oldKeysBase64 ...string) error {
	if currentKeyBase64 == "" {
		DefaultEncryptor = nil
		return nil
	}

	primaryKey, err := decodeKey(currentKeyBase64)
	if err != nil {
		return fmt.Errorf("secrets: invalid primary encryption key: %w", err)
	}

	var oldKeys [][]byte
	for i, oldKeyB64 := range oldKeysBase64 {
		if oldKeyB64 == "" {
			continue
		}
		k, err := decodeKey(oldKeyB64)
		if err != nil {
			return fmt.Errorf("secrets: invalid old encryption key [%d]: %w", i, err)
		}
		oldKeys = append(oldKeys, k)
	}

	DefaultEncryptor = &Encryptor{primaryKey: primaryKey, oldKeys: oldKeys}
	return nil
}

// decodeKey decodes and validates a base64-encoded 32-byte AES key.
func decodeKey(keyBase64 string) ([]byte, error) {
	key, err := base64.StdEncoding.DecodeString(keyBase64)
	if err != nil {
		return nil, fmt.Errorf("invalid base64: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("encryption key must be 32 bytes (AES-256), got %d", len(key))
	}
	return key, nil
}

// Enabled returns true if the default encryptor is initialized.
func Enabled() bool {
	return DefaultEncryptor != nil
}

// Encryptor performs AES-256-GCM encryption and decryption.
type Encryptor struct {
	primaryKey []byte
	oldKeys    [][]byte
}

// Encrypt encrypts plaintext using the primary key and returns "$vc_enc$v1$<base64(nonce|ciphertext)>".
func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(e.primaryKey)
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
	return encV1Prefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts a value produced by Encrypt. It supports both the old format
// ($vc_enc$<base64>) and the versioned format ($vc_enc$v1$<base64>).
// On GCM auth failure with the primary key, it tries each old key before returning an error.
func (e *Encryptor) Decrypt(value string) (string, error) {
	if !strings.HasPrefix(value, encPrefix) {
		return "", fmt.Errorf("secrets: value does not have encryption prefix")
	}

	// Parse the payload — strip version prefix if present, otherwise strip legacy prefix
	var payload string
	if strings.HasPrefix(value, encV1Prefix) {
		payload = strings.TrimPrefix(value, encV1Prefix)
	} else {
		payload = strings.TrimPrefix(value, encPrefix)
	}

	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", fmt.Errorf("secrets: invalid base64: %w", err)
	}

	// Try primary key first, then old keys
	keys := append([][]byte{e.primaryKey}, e.oldKeys...)
	for _, key := range keys {
		plaintext, err := decryptWithKey(key, data)
		if err == nil {
			return plaintext, nil
		}
	}

	return "", fmt.Errorf("secrets: decryption failed with all keys")
}

// decryptWithKey attempts to decrypt data with a single AES-256-GCM key.
func decryptWithKey(key, data []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// IsEncrypted returns true if the value has the "$vc_enc$" prefix.
func IsEncrypted(value string) bool {
	return strings.HasPrefix(value, encPrefix)
}
