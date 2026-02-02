package exchange

// SecretConfigPaths are the sensitive fields within the exchange JSON config
// that should be encrypted at rest.
var SecretConfigPaths = []string{
	"exchange.key",
	"exchange.secret",
	"exchange.password",
	"exchange.private_key",
}
