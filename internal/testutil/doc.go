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
