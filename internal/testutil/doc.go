//go:build integration

/*
Package testutil provides testing utilities for integration tests with external services.

# Overview

This package contains infrastructure for running integration tests against real
external services using testcontainers. It's designed to provide high-fidelity
testing while maintaining isolation and reproducibility.

# Keycloak Integration Testing

The primary component is KeycloakContainer, which manages a Docker-based Keycloak
instance for testing authentication and authorization flows.

## Usage

	func TestMain(m *testing.M) {
		ctx := context.Background()

		// Start Keycloak container
		kc, err := testutil.StartKeycloakContainer(ctx)
		if err != nil {
			log.Fatal(err)
		}

		// Run tests
		code := m.Run()

		// Cleanup
		kc.Stop(ctx)
		os.Exit(code)
	}

	func TestSomething(t *testing.T) {
		// Create clients for testing
		adminClient := kc.NewAdminClient()
		umaClient := kc.NewUMAClient()

		// Use clients in tests...
	}

# Build Tags

This package uses the `integration` build tag to prevent accidental inclusion
in regular test runs. Integration tests require Docker and take longer to run.

Run integration tests with:

	go test -tags=integration ./...

Or use the Makefile:

	make test-integration

# Configuration

The following test credentials are used (defined as constants):

  - KeycloakAdminUser: "admin"
  - KeycloakAdminPassword: "admin"
  - TestRealm: "volaticloud"
  - TestClientID: "volaticloud"
  - TestClientSecret: "test-secret"

These are test-only credentials and should never be used in production.

# Realm Configuration

The test realm is imported from testdata/volaticloud-realm.json. This file contains:

  - Client configurations (volaticloud, dashboard)
  - Authorization scopes (view, edit, delete, etc.)
  - Resource server settings

When Keycloak configuration changes in production, update the test realm to match.

# Regenerating the Test Realm

If you need to regenerate the test realm file (e.g., after making changes to the
production Keycloak configuration), follow these steps:

1. Start a local Keycloak instance with the production configuration:

	docker run -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin \
		quay.io/keycloak/keycloak:latest start-dev

2. Configure the realm in the Keycloak admin console (http://localhost:8080):
  - Create a "volaticloud" realm
  - Create clients: "volaticloud" (confidential) and "dashboard" (public)
  - Configure authorization settings and scopes
  - Set up the required roles and permissions

3. Export the realm configuration:
  - Go to Realm Settings > Action > Partial Export
  - Enable "Export clients" and "Export groups and roles"
  - Download the JSON file

4. Minimize the exported file:
  - Remove user data (not needed for tests)
  - Remove session data
  - Keep only essential configuration
  - Replace production secrets with test values

5. Save the file as internal/testutil/testdata/volaticloud-realm.json

6. Test the new configuration:

	make test-integration

Note: The test realm uses test-only credentials. Never copy production secrets
into the test realm file.

# Minimal Realm Requirements

The test realm must include:

  - Realm: "volaticloud"
  - Client "volaticloud" with:
  - Client authentication enabled (confidential)
  - Service accounts enabled
  - Authorization enabled with these scopes:
    view, edit, delete, backtest, view-secrets, view-users, invite-user,
    change-user-roles, create-strategy, create-bot, create-exchange, create-runner
  - Client "dashboard" with:
  - Public client (no secret required)
  - Standard flow enabled

# Architecture

	┌─────────────────────────────────────────────────────────┐
	│                   Integration Test                       │
	├─────────────────────────────────────────────────────────┤
	│  testutil.StartKeycloakContainer()                      │
	│           │                                              │
	│           ▼                                              │
	│  ┌─────────────────────────────────────┐                │
	│  │      KeycloakContainer              │                │
	│  │  ┌─────────────────────────────┐   │                │
	│  │  │  Docker Container           │   │                │
	│  │  │  (quay.io/keycloak/keycloak)│   │                │
	│  │  └─────────────────────────────┘   │                │
	│  │  • NewAdminClient()                │                │
	│  │  • NewUMAClient()                  │                │
	│  │  • Stop()                          │                │
	│  └─────────────────────────────────────┘                │
	└─────────────────────────────────────────────────────────┘

# Related Documentation

  - [ADR-0017: Hybrid Testing Strategy](/docs/adr/0017-hybrid-testing-strategy.md)
  - [ADR-0008: Multi-Tenant Authorization](/docs/adr/0008-multi-tenant-authorization.md)
  - [Testcontainers for Go](https://golang.testcontainers.org/)
*/
package testutil
