package bot

// SecretConfigPaths are the sensitive fields within the bot secure_config JSON
// that should be encrypted at rest.
var SecretConfigPaths = []string{
	"api_server.username",
	"api_server.password",
	"api_server.jwt_secret_key",
}
