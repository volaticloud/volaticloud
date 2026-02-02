package secrets

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testKey() string {
	// 32-byte key for testing
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	return base64.StdEncoding.EncodeToString(key)
}

func TestInit(t *testing.T) {
	// Reset after test
	defer func() { DefaultEncryptor = nil }()

	t.Run("valid key", func(t *testing.T) {
		err := Init(testKey())
		require.NoError(t, err)
		assert.True(t, Enabled())
	})

	t.Run("empty key disables", func(t *testing.T) {
		err := Init("")
		require.NoError(t, err)
		assert.False(t, Enabled())
	})

	t.Run("invalid base64", func(t *testing.T) {
		err := Init("not-valid-base64!!!")
		assert.Error(t, err)
	})

	t.Run("wrong key length", func(t *testing.T) {
		shortKey := base64.StdEncoding.EncodeToString([]byte("tooshort"))
		err := Init(shortKey)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "32 bytes")
	})
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	require.NoError(t, Init(testKey()))
	defer func() { DefaultEncryptor = nil }()

	tests := []struct {
		name      string
		plaintext string
	}{
		{"simple", "my-secret-key"},
		{"empty", ""},
		{"unicode", "secret-key-123"},
		{"long", "a very long secret that contains special characters: !@#$%^&*()"},
		{"json-like", `{"nested": "value"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.plaintext == "" {
				// Empty strings are skipped by encrypt
				return
			}

			encrypted, err := DefaultEncryptor.Encrypt(tt.plaintext)
			require.NoError(t, err)
			assert.True(t, IsEncrypted(encrypted))
			assert.NotEqual(t, tt.plaintext, encrypted)

			decrypted, err := DefaultEncryptor.Decrypt(encrypted)
			require.NoError(t, err)
			assert.Equal(t, tt.plaintext, decrypted)
		})
	}
}

func TestEncryptProducesDifferentCiphertexts(t *testing.T) {
	require.NoError(t, Init(testKey()))
	defer func() { DefaultEncryptor = nil }()

	// Same plaintext should produce different ciphertexts (random nonce)
	enc1, err := DefaultEncryptor.Encrypt("same-value")
	require.NoError(t, err)
	enc2, err := DefaultEncryptor.Encrypt("same-value")
	require.NoError(t, err)

	assert.NotEqual(t, enc1, enc2)

	// Both should decrypt to the same value
	dec1, _ := DefaultEncryptor.Decrypt(enc1)
	dec2, _ := DefaultEncryptor.Decrypt(enc2)
	assert.Equal(t, dec1, dec2)
}

func TestDecryptWithWrongKey(t *testing.T) {
	require.NoError(t, Init(testKey()))
	encrypted, err := DefaultEncryptor.Encrypt("secret")
	require.NoError(t, err)

	// Use a different key
	otherKey := make([]byte, 32)
	for i := range otherKey {
		otherKey[i] = byte(i + 100)
	}
	other := &Encryptor{key: otherKey}

	_, err = other.Decrypt(encrypted)
	assert.Error(t, err)

	DefaultEncryptor = nil
}

func TestDecryptNoPrefix(t *testing.T) {
	require.NoError(t, Init(testKey()))
	defer func() { DefaultEncryptor = nil }()

	_, err := DefaultEncryptor.Decrypt("no-prefix-value")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "prefix")
}

func TestDecryptInvalidBase64(t *testing.T) {
	require.NoError(t, Init(testKey()))
	defer func() { DefaultEncryptor = nil }()

	_, err := DefaultEncryptor.Decrypt("$vc_enc$not-valid-base64!!!")
	assert.Error(t, err)
}

func TestDecryptTooShort(t *testing.T) {
	require.NoError(t, Init(testKey()))
	defer func() { DefaultEncryptor = nil }()

	// Valid base64 but too short for nonce
	_, err := DefaultEncryptor.Decrypt("$vc_enc$" + base64.StdEncoding.EncodeToString([]byte("short")))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "too short")
}

func TestIsEncrypted(t *testing.T) {
	assert.True(t, IsEncrypted("$vc_enc$abc123"))
	assert.False(t, IsEncrypted("enc:something"))
	assert.False(t, IsEncrypted("plaintext"))
	assert.False(t, IsEncrypted(""))
}
