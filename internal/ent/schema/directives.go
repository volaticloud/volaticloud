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
