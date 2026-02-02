package secrets

import (
	"context"
	"testing"

	"entgo.io/ent"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	entgen "volaticloud/internal/ent"
)

// mockMutation implements the subset of ent.Mutation needed by EncryptHook.
type mockMutation struct {
	ent.Mutation
	fields    map[string]interface{}
	setFields map[string]interface{}
}

func newMockMutation(fields map[string]interface{}) *mockMutation {
	return &mockMutation{
		fields:    fields,
		setFields: make(map[string]interface{}),
	}
}

func (m *mockMutation) Field(name string) (ent.Value, bool) {
	v, ok := m.fields[name]
	return v, ok
}

func (m *mockMutation) SetField(name string, value ent.Value) error {
	m.setFields[name] = value
	return nil
}

// passThroughMutator is a mutator that just records that it was called.
type passThroughMutator struct{ called bool }

func (p *passThroughMutator) Mutate(_ context.Context, _ ent.Mutation) (ent.Value, error) {
	p.called = true
	return nil, nil
}

func TestEncryptHook_EncryptsSecretFields(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"name":   "binance",
			"key":    "my-api-key",
			"secret": "my-secret",
		},
	}

	m := newMockMutation(map[string]interface{}{"config": config})
	next := &passThroughMutator{}

	hook := EncryptHook("config", testExchangePaths)
	mutator := hook(next)
	_, err := mutator.Mutate(context.Background(), m)
	require.NoError(t, err)
	assert.True(t, next.called)

	// The config should have been set back with encrypted values
	setConfig := m.setFields["config"].(map[string]interface{})
	exch := setConfig["exchange"].(map[string]interface{})
	assert.True(t, IsEncrypted(exch["key"].(string)))
	assert.True(t, IsEncrypted(exch["secret"].(string)))
	assert.Equal(t, "binance", exch["name"])
}

func TestEncryptHook_SkipsWhenDisabled(t *testing.T) {
	DefaultEncryptor = nil

	config := map[string]interface{}{
		"exchange": map[string]interface{}{"key": "plaintext"},
	}

	m := newMockMutation(map[string]interface{}{"config": config})
	next := &passThroughMutator{}

	hook := EncryptHook("config", testExchangePaths)
	mutator := hook(next)
	_, err := mutator.Mutate(context.Background(), m)
	require.NoError(t, err)
	assert.True(t, next.called)
	// No setField call since encryption is disabled
	assert.Empty(t, m.setFields)
}

func TestEncryptHook_SkipsWhenFieldMissing(t *testing.T) {
	setupEncryptor(t)

	m := newMockMutation(map[string]interface{}{}) // no "config" field
	next := &passThroughMutator{}

	hook := EncryptHook("config", testExchangePaths)
	mutator := hook(next)
	_, err := mutator.Mutate(context.Background(), m)
	require.NoError(t, err)
	assert.True(t, next.called)
	assert.Empty(t, m.setFields)
}

func TestEncryptHook_SkipsNilConfig(t *testing.T) {
	setupEncryptor(t)

	m := newMockMutation(map[string]interface{}{"config": nil})
	next := &passThroughMutator{}

	hook := EncryptHook("config", testExchangePaths)
	mutator := hook(next)
	_, err := mutator.Mutate(context.Background(), m)
	require.NoError(t, err)
	assert.True(t, next.called)
}

func TestEncryptHook_SkipsNonMapConfig(t *testing.T) {
	setupEncryptor(t)

	m := newMockMutation(map[string]interface{}{"config": "not-a-map"})
	next := &passThroughMutator{}

	hook := EncryptHook("config", testExchangePaths)
	mutator := hook(next)
	_, err := mutator.Mutate(context.Background(), m)
	require.NoError(t, err)
	assert.True(t, next.called)
	assert.Empty(t, m.setFields)
}

func TestDecryptExchangeResults_Slice(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"key":    "my-key",
			"secret": "my-secret",
		},
	}
	require.NoError(t, EncryptFields(config, testExchangePaths))

	exchanges := []*entgen.Exchange{
		{ID: uuid.New(), Config: config},
		{ID: uuid.New(), Config: nil}, // nil config should be skipped
	}

	result, err := decryptExchangeResults(exchanges)
	require.NoError(t, err)

	decrypted := result.([]*entgen.Exchange)
	exch := decrypted[0].Config["exchange"].(map[string]interface{})
	assert.Equal(t, "my-key", exch["key"])
	assert.Equal(t, "my-secret", exch["secret"])
}

func TestDecryptExchangeResults_Single(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"exchange": map[string]interface{}{
			"key": "my-key",
		},
	}
	require.NoError(t, EncryptFields(config, testExchangePaths))

	e := &entgen.Exchange{ID: uuid.New(), Config: config}

	result, err := decryptExchangeResults(e)
	require.NoError(t, err)

	decrypted := result.(*entgen.Exchange)
	exch := decrypted.Config["exchange"].(map[string]interface{})
	assert.Equal(t, "my-key", exch["key"])
}

func TestDecryptExchangeResults_NilSingle(t *testing.T) {
	setupEncryptor(t)

	result, err := decryptExchangeResults((*entgen.Exchange)(nil))
	require.NoError(t, err)
	assert.Nil(t, result.(*entgen.Exchange))
}

func TestDecryptExchangeResults_UnknownType(t *testing.T) {
	setupEncryptor(t)

	// Non-exchange type should pass through unchanged
	result, err := decryptExchangeResults("something-else")
	require.NoError(t, err)
	assert.Equal(t, "something-else", result)
}

func TestDecryptRunnerResults_Slice(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"docker": map[string]interface{}{
			"host":    "tcp://localhost:2375",
			"certPEM": "cert-data",
			"keyPEM":  "key-data",
		},
	}
	s3Config := map[string]interface{}{
		"accessKeyId":     "AKIA123",
		"secretAccessKey": "secret123",
		"bucket":          "my-bucket",
	}
	require.NoError(t, EncryptFields(config, []string{"docker.certPEM", "docker.keyPEM", "docker.caPEM"}))
	require.NoError(t, EncryptFields(s3Config, testS3Paths))

	runners := []*entgen.BotRunner{
		{ID: uuid.New(), Config: config, S3Config: s3Config},
		{ID: uuid.New(), Config: nil, S3Config: nil},
	}

	result, err := decryptRunnerResults(runners)
	require.NoError(t, err)

	decrypted := result.([]*entgen.BotRunner)
	docker := decrypted[0].Config["docker"].(map[string]interface{})
	assert.Equal(t, "cert-data", docker["certPEM"])
	assert.Equal(t, "key-data", docker["keyPEM"])
	assert.Equal(t, "tcp://localhost:2375", docker["host"])
	assert.Equal(t, "AKIA123", decrypted[0].S3Config["accessKeyId"])
	assert.Equal(t, "secret123", decrypted[0].S3Config["secretAccessKey"])
	assert.Equal(t, "my-bucket", decrypted[0].S3Config["bucket"])
}

func TestDecryptRunnerResults_Single(t *testing.T) {
	setupEncryptor(t)

	config := map[string]interface{}{
		"kubernetes": map[string]interface{}{
			"kubeconfig": "apiVersion: v1\nkind: Config",
			"namespace":  "default",
		},
	}
	require.NoError(t, EncryptFields(config, []string{"kubernetes.kubeconfig"}))

	r := &entgen.BotRunner{ID: uuid.New(), Config: config}
	result, err := decryptRunnerResults(r)
	require.NoError(t, err)

	decrypted := result.(*entgen.BotRunner)
	k8s := decrypted.Config["kubernetes"].(map[string]interface{})
	assert.Equal(t, "apiVersion: v1\nkind: Config", k8s["kubeconfig"])
	assert.Equal(t, "default", k8s["namespace"])
}

func TestDecryptRunnerResults_NilSingle(t *testing.T) {
	setupEncryptor(t)

	result, err := decryptRunnerResults((*entgen.BotRunner)(nil))
	require.NoError(t, err)
	assert.Nil(t, result.(*entgen.BotRunner))
}

func TestDecryptRunnerResults_UnknownType(t *testing.T) {
	setupEncryptor(t)

	result, err := decryptRunnerResults(42)
	require.NoError(t, err)
	assert.Equal(t, 42, result)
}
