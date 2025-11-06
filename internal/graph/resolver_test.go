package graph

import (
	"anytrade/internal/ent"
	"anytrade/internal/ent/enttest"
	"testing"

	"entgo.io/ent/dialect"
	_ "github.com/mattn/go-sqlite3"
)

// setupTestClient creates a new test ENT client with in-memory SQLite
func setupTestClient(t *testing.T) *ent.Client {
	opts := []enttest.Option{
		enttest.WithOptions(ent.Log(t.Log)),
	}
	client := enttest.Open(t, dialect.SQLite, "file:ent?mode=memory&cache=shared&_fk=1", opts...)
	t.Cleanup(func() {
		client.Close()
	})
	return client
}

// setupTestResolver creates a new resolver with a test client
func setupTestResolver(t *testing.T) *Resolver {
	client := setupTestClient(t)
	return NewResolver(client)
}
