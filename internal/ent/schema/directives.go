package schema

import (
	"entgo.io/contrib/entgql"
	"github.com/vektah/gqlparser/v2/ast"
)

// HasScope adds the @hasScope directive to a field for field-level authorization
// This enforces Keycloak UMA authorization by extracting the resource ID from the parent object
//
// Usage:
//
//	field.Text("code").
//	  Annotations(HasScope("view", "STRATEGY"))
//
//	field.JSON("config", map[string]interface{}{}).
//	  Annotations(entgql.Type("Map"), HasScope("view-secrets", "BOT"))
func HasScope(scope string, resourceType string) entgql.Annotation {
	return entgql.Directives(entgql.Directive{
		Name: "hasScope",
		Arguments: []*ast.Argument{
			{
				Name: "resource",
				Value: &ast.Value{
					Kind: ast.StringValue,
					Raw:  "id",
				},
			},
			{
				Name: "scope",
				Value: &ast.Value{
					Kind: ast.StringValue,
					Raw:  scope,
				},
			},
			{
				Name: "resourceType",
				Value: &ast.Value{
					Kind: ast.EnumValue,
					Raw:  resourceType,
				},
			},
			{
				Name: "fromParent",
				Value: &ast.Value{
					Kind: ast.BooleanValue,
					Raw:  "true",
				},
			},
		},
	})
}

// HasScopeWithField adds the @hasScope directive with a custom ID field
// Use this when the resource ID is in a different field than "id" (e.g., "strategyID" for Backtest)
//
// SECURITY WARNING: This function enables cross-resource permission checking, where Entity A's
// fields are protected by Entity B's permissions. This pattern should ONLY be used when:
//   - Entity A has a strong ownership relationship with Entity B (e.g., Backtest belongs to Strategy)
//   - Entity A does NOT have its own Keycloak resource (to avoid permission confusion)
//   - The referenced field (idField) is immutable and set at creation time
//
// Misuse can lead to permission escalation vulnerabilities. Always verify that granting access
// to Entity B logically implies access to Entity A's protected fields.
//
// Valid use case: Backtest.result protected by Strategy permissions (Backtest is an analysis
// artifact of Strategy, not an independent resource)
//
// Usage:
//
//	field.Text("sensitive_data").
//	  Annotations(HasScopeWithField("view", "strategyID", "STRATEGY"))
func HasScopeWithField(scope string, idField string, resourceType string) entgql.Annotation {
	return entgql.Directives(entgql.Directive{
		Name: "hasScope",
		Arguments: []*ast.Argument{
			{
				Name: "resource",
				Value: &ast.Value{
					Kind: ast.StringValue,
					Raw:  idField,
				},
			},
			{
				Name: "scope",
				Value: &ast.Value{
					Kind: ast.StringValue,
					Raw:  scope,
				},
			},
			{
				Name: "resourceType",
				Value: &ast.Value{
					Kind: ast.EnumValue,
					Raw:  resourceType,
				},
			},
			{
				Name: "fromParent",
				Value: &ast.Value{
					Kind: ast.BooleanValue,
					Raw:  "true",
				},
			},
		},
	})
}
