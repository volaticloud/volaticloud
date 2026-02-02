package secrets

import (
	"fmt"
	"strings"
)

// EncryptFields encrypts secret fields in a config map at the given dot-paths.
// Fields that are already encrypted (have "enc:" prefix) are skipped.
// Fields that don't exist or are not strings are skipped.
func EncryptFields(config map[string]interface{}, paths []string) error {
	if !Enabled() || config == nil {
		return nil
	}
	for _, path := range paths {
		if err := transformField(config, path, encrypt); err != nil {
			return fmt.Errorf("encrypt field %q: %w", path, err)
		}
	}
	return nil
}

// DecryptFields decrypts secret fields in a config map at the given dot-paths.
// Fields that are not encrypted (no "enc:" prefix) pass through unchanged.
// Fields that don't exist or are not strings are skipped.
func DecryptFields(config map[string]interface{}, paths []string) error {
	if !Enabled() || config == nil {
		return nil
	}
	for _, path := range paths {
		if err := transformField(config, path, decrypt); err != nil {
			return fmt.Errorf("decrypt field %q: %w", path, err)
		}
	}
	return nil
}

type transformFunc func(string) (string, error)

func encrypt(value string) (string, error) {
	if IsEncrypted(value) {
		return value, nil // already encrypted
	}
	if value == "" {
		return value, nil // skip empty
	}
	return DefaultEncryptor.Encrypt(value)
}

func decrypt(value string) (string, error) {
	if !IsEncrypted(value) {
		return value, nil // plaintext passthrough
	}
	return DefaultEncryptor.Decrypt(value)
}

// transformField walks a config map to a dot-separated path and applies fn to the string value.
func transformField(config map[string]interface{}, path string, fn transformFunc) error {
	parts := strings.Split(path, ".")
	current := config

	// Walk to the parent of the target field
	for i := 0; i < len(parts)-1; i++ {
		next, ok := current[parts[i]]
		if !ok {
			return nil // path doesn't exist, skip
		}
		nextMap, ok := next.(map[string]interface{})
		if !ok {
			return nil // intermediate value is not a map, skip
		}
		current = nextMap
	}

	// Get and transform the leaf value
	key := parts[len(parts)-1]
	value, ok := current[key]
	if !ok {
		return nil // field doesn't exist, skip
	}

	strValue, ok := value.(string)
	if !ok {
		return nil // not a string, skip
	}

	transformed, err := fn(strValue)
	if err != nil {
		return err
	}

	current[key] = transformed
	return nil
}
