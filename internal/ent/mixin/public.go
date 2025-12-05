package mixin

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/mixin"
)

// PublicMixin adds a public field to entities for visibility control.
// When public is true, the resource is visible to all authenticated users.
// When public is false (default), the resource is only visible to the owner.
type PublicMixin struct {
	mixin.Schema
}

// Fields returns the public field.
func (PublicMixin) Fields() []ent.Field {
	return []ent.Field{
		field.Bool("public").
			Default(false).
			Comment("Whether this resource is publicly visible to all authenticated users"),
	}
}
