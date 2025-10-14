package enum

import (
	"fmt"
	"io"
	"strconv"
)

// RuntimeType represents the runtime environment type
type RuntimeType string

const (
	RuntimeDocker     RuntimeType = "docker"
	RuntimeKubernetes RuntimeType = "kubernetes"
	RuntimeLocal      RuntimeType = "local"
)

// Values returns all possible runtime type values
func (RuntimeType) Values() []string {
	return []string{
		string(RuntimeDocker),
		string(RuntimeKubernetes),
		string(RuntimeLocal),
	}
}

// MarshalGQL implements graphql.Marshaler for RuntimeType
func (r RuntimeType) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(r)))
}

// UnmarshalGQL implements graphql.Unmarshaler for RuntimeType
func (r *RuntimeType) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("runtime type must be a string")
	}
	*r = RuntimeType(str)
	return nil
}