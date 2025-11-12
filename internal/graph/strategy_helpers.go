package graph

// coalesce returns the new value if provided, otherwise returns the old value
func coalesce[T any](newVal, oldVal *T) T {
	if newVal != nil {
		return *newVal
	}
	return *oldVal
}
