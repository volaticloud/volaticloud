package enum

import (
	"fmt"
	"io"
	"strconv"
)

// ResourceType represents the type of resource for usage tracking
type ResourceType string

const (
	ResourceTypeBot      ResourceType = "bot"
	ResourceTypeBacktest ResourceType = "backtest"
)

// Values returns all possible resource type values
func (ResourceType) Values() []string {
	return []string{
		string(ResourceTypeBot),
		string(ResourceTypeBacktest),
	}
}

// MarshalGQL implements graphql.Marshaler for ResourceType
func (r ResourceType) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(r)))
}

// UnmarshalGQL implements graphql.Unmarshaler for ResourceType
func (r *ResourceType) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("resource type must be a string")
	}
	*r = ResourceType(str)
	return nil
}

// AggregationGranularity represents the granularity level for usage aggregation
type AggregationGranularity string

const (
	AggregationGranularityHourly AggregationGranularity = "hourly"
	AggregationGranularityDaily  AggregationGranularity = "daily"
)

// Values returns all possible aggregation granularity values
func (AggregationGranularity) Values() []string {
	return []string{
		string(AggregationGranularityHourly),
		string(AggregationGranularityDaily),
	}
}

// MarshalGQL implements graphql.Marshaler for AggregationGranularity
func (a AggregationGranularity) MarshalGQL(w io.Writer) {
	fmt.Fprint(w, strconv.Quote(string(a)))
}

// UnmarshalGQL implements graphql.Unmarshaler for AggregationGranularity
func (a *AggregationGranularity) UnmarshalGQL(v interface{}) error {
	str, ok := v.(string)
	if !ok {
		return fmt.Errorf("aggregation granularity must be a string")
	}
	*a = AggregationGranularity(str)
	return nil
}
