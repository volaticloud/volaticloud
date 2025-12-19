package runner

import (
	"context"
	"fmt"
	"sync"

	"volaticloud/internal/enum"
)

// RuntimeCreator is a function that creates a Runtime instance
type RuntimeCreator func(ctx context.Context, configData map[string]interface{}) (Runtime, error)

// BacktestRunnerCreator is a function that creates a BacktestRunner instance
type BacktestRunnerCreator func(ctx context.Context, configData map[string]interface{}) (BacktestRunner, error)

// ConfigValidator is a function that validates runner configuration
type ConfigValidator func(configData map[string]interface{}) error

// registry holds registered creators and validators for each runner type
var (
	runtimeCreators        = make(map[enum.RunnerType]RuntimeCreator)
	backtestRunnerCreators = make(map[enum.RunnerType]BacktestRunnerCreator)
	configValidators       = make(map[enum.RunnerType]ConfigValidator)
	registryMu             sync.RWMutex
)

// RegisterRuntimeCreator registers a RuntimeCreator for a specific runner type
func RegisterRuntimeCreator(runnerType enum.RunnerType, creator RuntimeCreator) {
	registryMu.Lock()
	defer registryMu.Unlock()
	runtimeCreators[runnerType] = creator
}

// RegisterBacktestRunnerCreator registers a BacktestRunnerCreator for a specific runner type
func RegisterBacktestRunnerCreator(runnerType enum.RunnerType, creator BacktestRunnerCreator) {
	registryMu.Lock()
	defer registryMu.Unlock()
	backtestRunnerCreators[runnerType] = creator
}

// RegisterConfigValidator registers a ConfigValidator for a specific runner type
func RegisterConfigValidator(runnerType enum.RunnerType, validator ConfigValidator) {
	registryMu.Lock()
	defer registryMu.Unlock()
	configValidators[runnerType] = validator
}

// GetRuntimeCreator returns the RuntimeCreator for a specific runner type
func GetRuntimeCreator(runnerType enum.RunnerType) (RuntimeCreator, error) {
	registryMu.RLock()
	defer registryMu.RUnlock()
	creator, ok := runtimeCreators[runnerType]
	if !ok {
		return nil, fmt.Errorf("no runtime creator registered for runner type: %s", runnerType)
	}
	return creator, nil
}

// GetBacktestRunnerCreator returns the BacktestRunnerCreator for a specific runner type
func GetBacktestRunnerCreator(runnerType enum.RunnerType) (BacktestRunnerCreator, error) {
	registryMu.RLock()
	defer registryMu.RUnlock()
	creator, ok := backtestRunnerCreators[runnerType]
	if !ok {
		return nil, fmt.Errorf("no backtest runner creator registered for runner type: %s", runnerType)
	}
	return creator, nil
}

// GetConfigValidator returns the ConfigValidator for a specific runner type
func GetConfigValidator(runnerType enum.RunnerType) (ConfigValidator, error) {
	registryMu.RLock()
	defer registryMu.RUnlock()
	validator, ok := configValidators[runnerType]
	if !ok {
		return nil, fmt.Errorf("no config validator registered for runner type: %s", runnerType)
	}
	return validator, nil
}
