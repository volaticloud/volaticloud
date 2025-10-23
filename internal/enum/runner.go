package enum

import (
	"fmt"
	"io"
	"strconv"
)

// RunnerType represents the runner environment type
type RunnerType string

const (
	RunnerDocker     RunnerType = "docker"
	RunnerKubernetes RunnerType = "kubernetes"
	RunnerLocal      RunnerType = "local"
)

// Values returns all possible runner type values
func (RunnerType) Values() []string {
	return []string{
		string(RunnerDocker),
		string(RunnerKubernetes),
		string(RunnerLocal),
	}
}

// MarshalGQL implements graphql.Marshaler for RunnerType
func (r RunnerType) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(r)))
}

// UnmarshalGQL implements graphql.Unmarshaler for RunnerType
func (r *RunnerType) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("runner type must be a string")
	}
	*r = RunnerType(str)
	return nil
}