package schema

import (
	"entgo.io/contrib/entgql"
	"github.com/vektah/gqlparser/v2/ast"
)

// RequiresPermission adds the @requiresPermission directive to a field
// This enforces Keycloak UMA authorization at the field level
//
// Usage:
//
//	field.Text("code").
//	  Annotations(RequiresPermission("view"))
//
//	field.JSON("config", map[string]interface{}{}).
//	  Annotations(entgql.Type("Map"), RequiresPermission("view"))
func RequiresPermission(scope string) entgql.Annotation {
	return entgql.Directives(entgql.Directive{
		Name: "requiresPermission",
		Arguments: []*ast.Argument{
			{
				Name: "scope",
				Value: &ast.Value{
					Kind: ast.StringValue,
					Raw:  scope,
				},
			},
		},
	})
}

// RequiresPermissionWithField adds the @requiresPermission directive with custom ID field
//
// Usage:
//
//	field.Text("sensitive_data").
//	  Annotations(RequiresPermissionWithField("view", "customID"))
func RequiresPermissionWithField(scope string, idField string) entgql.Annotation {
	return entgql.Directives(entgql.Directive{
		Name: "requiresPermission",
		Arguments: []*ast.Argument{
			{
				Name: "scope",
				Value: &ast.Value{
					Kind: ast.StringValue,
					Raw:  scope,
				},
			},
			{
				Name: "idField",
				Value: &ast.Value{
					Kind: ast.StringValue,
					Raw:  idField,
				},
			},
		},
	})
}
