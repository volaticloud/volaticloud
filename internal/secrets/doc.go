// Package secrets provides field-level AES-256-GCM encryption for sensitive
// fields within JSON config blobs stored in the database.
//
// Non-secret fields remain plaintext and queryable. Decryption is transparent —
// code that reads configs gets plaintext automatically via ENT hooks and interceptors.
//
// # Architecture
//
// Encryption is applied at the ENT hook layer:
//   - EncryptHook: encrypts specified dot-path fields in a JSON config on write
//   - DecryptInterceptor: decrypts fields after query execution on read
//
// Encrypted values are stored with an "$vc_enc$" prefix followed by base64-encoded
// nonce + ciphertext + GCM tag. The prefix allows graceful migration — plaintext
// values pass through the decrypt path unchanged.
//
// # Initialization
//
// Call Init() at startup with a base64-encoded 32-byte AES key:
//
//	secrets.Init(keyBase64)
//
// If no key is provided, encryption is disabled and all operations are no-ops.
// This allows smooth rollout without requiring the key from day one.
//
// # Secret Field Paths
//
// Fields are identified by dot-separated paths into JSON config maps:
//
//	Exchange.config:    exchange.key, exchange.secret, exchange.password, exchange.private_key
//	BotRunner.config:   docker.certPEM, docker.keyPEM, docker.caPEM
//	BotRunner.s3_config: accessKeyId, secretAccessKey
package secrets
