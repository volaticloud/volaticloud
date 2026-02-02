package secrets

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test paths matching the domain definitions — kept here to avoid circular imports.
var (
	testExchangePaths = []string{"exchange.key", "exchange.secret", "exchange.password", "exchange.private_key"}
	testS3Paths       = []string{"accessKeyId", "secretAccessKey"}
)

func setupEncryptor(t *testing.T) {
	t.Helper()
	require.NoError(t, Init(testKey()))
	t.Cleanup(func() { DefaultEncryptor = nil })
}

func TestEncryptFields(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"name":   "binance",
			"key":    "my-api-key",
			"secret": "my-api-secret",
		},
		"pair_whitelist": []string{"BTC/USDT"},
	}

	err := EncryptFields(config, testExchangePaths)
	require.NoError(t, err)

	exch := config["exchange"].(map[string]interface{})
	assert.True(t, IsEncrypted(exch["key"].(string)))
	assert.True(t, IsEncrypted(exch["secret"].(string)))

	assert.Equal(t, "binance", exch["name"])
	assert.Equal(t, []string{"BTC/USDT"}, config["pair_whitelist"])
}

func TestDecryptFields(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"name":   "binance",
			"key":    "my-api-key",
			"secret": "my-api-secret",
		},
	}

	require.NoError(t, EncryptFields(config, testExchangePaths))
	require.NoError(t, DecryptFields(config, testExchangePaths))

	exch := config["exchange"].(map[string]interface{})
	assert.Equal(t, "my-api-key", exch["key"])
	assert.Equal(t, "my-api-secret", exch["secret"])
	assert.Equal(t, "binance", exch["name"])
}

func TestEncryptFieldsIdempotent(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"key": "my-api-key",
		},
	}

	require.NoError(t, EncryptFields(config, testExchangePaths))
	firstEnc := config["exchange"].(map[string]interface{})["key"].(string)

	require.NoError(t, EncryptFields(config, testExchangePaths))
	secondEnc := config["exchange"].(map[string]interface{})["key"].(string)

	assert.Equal(t, firstEnc, secondEnc)
}

func TestDecryptFieldsPlaintextPassthrough(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"key": "plaintext-key",
		},
	}

	require.NoError(t, DecryptFields(config, testExchangePaths))

	exch := config["exchange"].(map[string]interface{})
	assert.Equal(t, "plaintext-key", exch["key"])
}

func TestEncryptFieldsMissingPaths(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"pair_whitelist": []string{"BTC/USDT"},
	}

	err := EncryptFields(config, testExchangePaths)
	require.NoError(t, err)
}

func TestEncryptFieldsNonStringValues(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"key": 12345,
		},
	}

	err := EncryptFields(config, testExchangePaths)
	require.NoError(t, err)
	assert.Equal(t, 12345, config["exchange"].(map[string]interface{})["key"])
}

func TestEncryptFieldsDisabled(t *testing.T) {
	DefaultEncryptor = nil

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"key": "my-api-key",
		},
	}

	err := EncryptFields(config, testExchangePaths)
	require.NoError(t, err)
	assert.Equal(t, "my-api-key", config["exchange"].(map[string]interface{})["key"])
}

func TestEncryptFieldsNilConfig(t *testing.T) {
	setupEncryptor(t)

	err := EncryptFields(nil, testExchangePaths)
	require.NoError(t, err)
}

func TestDecryptFieldsDisabled(t *testing.T) {
	DefaultEncryptor = nil

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"key": "plaintext",
		},
	}

	err := DecryptFields(config, testExchangePaths)
	require.NoError(t, err)
	assert.Equal(t, "plaintext", config["exchange"].(map[string]interface{})["key"])
}

func TestDecryptFieldsNilConfig(t *testing.T) {
	setupEncryptor(t)

	err := DecryptFields(nil, testExchangePaths)
	require.NoError(t, err)
}

func TestThreeLevelNestedPaths(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"docker": map[string]interface{}{
			"host": "tcp://localhost:2375",
			"registryAuth": map[string]interface{}{
				"username":      "admin",
				"password":      "secret-pass",
				"serverAddress": "https://index.docker.io/v1/",
			},
		},
	}

	paths := []string{"docker.registryAuth.username", "docker.registryAuth.password"}

	require.NoError(t, EncryptFields(config, paths))

	reg := config["docker"].(map[string]interface{})["registryAuth"].(map[string]interface{})
	assert.True(t, IsEncrypted(reg["username"].(string)))
	assert.True(t, IsEncrypted(reg["password"].(string)))
	assert.Equal(t, "https://index.docker.io/v1/", reg["serverAddress"])

	require.NoError(t, DecryptFields(config, paths))

	reg = config["docker"].(map[string]interface{})["registryAuth"].(map[string]interface{})
	assert.Equal(t, "admin", reg["username"])
	assert.Equal(t, "secret-pass", reg["password"])
}

func TestIntermediateNotMap(t *testing.T) {
	setupEncryptor(t)

	// Path expects nested map but intermediate is a string
	config := map[string]interface{}{
		"docker": "not-a-map",
	}

	err := EncryptFields(config, []string{"docker.certPEM"})
	require.NoError(t, err) // should skip, not error
	assert.Equal(t, "not-a-map", config["docker"])
}

func TestS3ConfigPaths(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"endpoint":        "https://s3.example.com",
		"bucket":          "my-bucket",
		"accessKeyId":     "AKIAIOSFODNN7EXAMPLE",
		"secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		"region":          "us-east-1",
	}

	require.NoError(t, EncryptFields(config, testS3Paths))

	assert.True(t, IsEncrypted(config["accessKeyId"].(string)))
	assert.True(t, IsEncrypted(config["secretAccessKey"].(string)))
	assert.Equal(t, "https://s3.example.com", config["endpoint"])
	assert.Equal(t, "my-bucket", config["bucket"])

	require.NoError(t, DecryptFields(config, testS3Paths))
	assert.Equal(t, "AKIAIOSFODNN7EXAMPLE", config["accessKeyId"])
	assert.Equal(t, "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", config["secretAccessKey"])
}
