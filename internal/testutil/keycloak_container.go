//go:build integration

// Package testutil provides testing utilities for integration tests
package testutil

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"volaticloud/internal/auth"
	"volaticloud/internal/keycloak"
)

const (
	// KeycloakPort is the HTTP port Keycloak listens on
	KeycloakPort = "8080/tcp"

	// KeycloakAdminUser is the admin username for Keycloak
	KeycloakAdminUser = "admin"

	// KeycloakAdminPassword is the admin password for Keycloak
	KeycloakAdminPassword = "admin"

	// TestRealm is the realm name used for testing
	TestRealm = "volaticloud"

	// TestClientID is the client ID used for testing
	TestClientID = "volaticloud"

	// TestClientSecret is the client secret used for testing
	TestClientSecret = "test-secret"

	// StartupTimeout is how long to wait for Keycloak to start
	// Set to 5 minutes to account for cold image pulls on CI runners
	StartupTimeout = 300 * time.Second
)

// KeycloakContainer holds testcontainer configuration and state
type KeycloakContainer struct {
	Container testcontainers.Container
	Config    auth.KeycloakConfig
	URL       string
}

// getProjectRoot finds the project root by looking for go.mod
func getProjectRoot() (string, error) {
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		return "", fmt.Errorf("failed to get current file path")
	}

	// Walk up from current file to find go.mod
	dir := filepath.Dir(currentFile)
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("could not find project root (go.mod)")
		}
		dir = parent
	}
}

// StartKeycloakContainer starts a Keycloak container for integration testing.
// The container is built from the local keycloak/Dockerfile and configured with a test realm.
func StartKeycloakContainer(ctx context.Context) (*KeycloakContainer, error) {
	// Get project root to find Dockerfile and realm file
	projectRoot, err := getProjectRoot()
	if err != nil {
		return nil, fmt.Errorf("failed to get project root: %w", err)
	}

	// Paths relative to project root
	dockerfilePath := filepath.Join(projectRoot, "keycloak")
	realmFilePath := filepath.Join(projectRoot, "internal", "testutil", "testdata", "volaticloud-realm.json")

	// Build the custom Keycloak image from local Dockerfile
	req := testcontainers.ContainerRequest{
		FromDockerfile: testcontainers.FromDockerfile{
			Context:       dockerfilePath,
			Dockerfile:    "Dockerfile",
			PrintBuildLog: true,
			KeepImage:     true, // Keep image for faster subsequent runs
		},
		ExposedPorts: []string{KeycloakPort, "9000/tcp"},
		Env: map[string]string{
			"KC_DB":                   "dev-file",
			"KC_HEALTH_ENABLED":       "true",
			"KEYCLOAK_ADMIN":          KeycloakAdminUser,
			"KEYCLOAK_ADMIN_PASSWORD": KeycloakAdminPassword,
			"KC_HOSTNAME_STRICT":      "false",
			"KC_HTTP_ENABLED":         "true",
		},
		Files: []testcontainers.ContainerFile{
			{
				HostFilePath:      realmFilePath,
				ContainerFilePath: "/opt/keycloak/data/import/volaticloud-realm.json",
				FileMode:          0644,
			},
		},
		Cmd: []string{"start-dev", "--import-realm"},
		WaitingFor: wait.ForAll(
			wait.ForHTTP("/health/ready").WithPort("9000").WithStartupTimeout(StartupTimeout),
		),
	}

	// Start the container
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to start keycloak container: %w", err)
	}

	// Get the mapped port
	mappedPort, err := container.MappedPort(ctx, "8080")
	if err != nil {
		container.Terminate(ctx)
		return nil, fmt.Errorf("failed to get mapped port: %w", err)
	}

	// Get the host
	host, err := container.Host(ctx)
	if err != nil {
		container.Terminate(ctx)
		return nil, fmt.Errorf("failed to get host: %w", err)
	}

	// Build the URL
	keycloakURL := fmt.Sprintf("http://%s:%s", host, mappedPort.Port())

	// Create config
	config := auth.KeycloakConfig{
		URL:          keycloakURL,
		Realm:        TestRealm,
		ClientID:     TestClientID,
		ClientSecret: TestClientSecret,
	}

	return &KeycloakContainer{
		Container: container,
		Config:    config,
		URL:       keycloakURL,
	}, nil
}

// Stop terminates the Keycloak container
func (kc *KeycloakContainer) Stop(ctx context.Context) error {
	if kc.Container != nil {
		return kc.Container.Terminate(ctx)
	}
	return nil
}

// NewAdminClient creates a new AdminClient connected to the test Keycloak instance
func (kc *KeycloakContainer) NewAdminClient() *keycloak.AdminClient {
	return keycloak.NewAdminClient(kc.Config)
}

// NewUMAClient creates a new UMAClient connected to the test Keycloak instance
func (kc *KeycloakContainer) NewUMAClient() *keycloak.UMAClient {
	return keycloak.NewUMAClient(
		kc.Config.URL,
		kc.Config.Realm,
		kc.Config.ClientID,
		kc.Config.ClientSecret,
		false, // testcontainers use HTTP, no TLS skip needed
	)
}

// GetConfig returns the Keycloak configuration for the container
func (kc *KeycloakContainer) GetConfig() auth.KeycloakConfig {
	return kc.Config
}
