package runner

// SecretConfigPaths are the sensitive fields within the runner JSON config
// that should be encrypted at rest. Covers all runner types.
var SecretConfigPaths = []string{
	// Docker TLS credentials
	"docker.certPEM",
	"docker.keyPEM",
	"docker.caPEM",
	// Docker registry auth
	"docker.registryAuth.username",
	"docker.registryAuth.password",
	// Kubernetes credentials
	"kubernetes.kubeconfig",
}

// SecretS3ConfigPaths are the sensitive fields within the runner S3 JSON config
// that should be encrypted at rest.
var SecretS3ConfigPaths = []string{
	"accessKeyId",
	"secretAccessKey",
}
