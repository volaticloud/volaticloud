package docker

import (
	"context"
	"fmt"

	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

func init() {
	// Register Docker runtime creator
	runner.RegisterRuntimeCreator(enum.RunnerDocker, func(ctx context.Context, configData map[string]interface{}) (runner.Runtime, error) {
		config, err := ParseConfig(configData)
		if err != nil {
			return nil, fmt.Errorf("failed to parse Docker config: %w", err)
		}

		runtime, err := NewRuntime(ctx, config)
		if err != nil {
			return nil, fmt.Errorf("failed to create Docker runtime: %w", err)
		}

		if err := runtime.HealthCheck(ctx); err != nil {
			runtime.Close()
			return nil, fmt.Errorf("Docker runtime health check failed: %w", err)
		}

		return runtime, nil
	})

	// Register Docker backtest runner creator
	runner.RegisterBacktestRunnerCreator(enum.RunnerDocker, func(ctx context.Context, configData map[string]interface{}) (runner.BacktestRunner, error) {
		config, err := ParseConfig(configData)
		if err != nil {
			return nil, fmt.Errorf("failed to parse Docker config: %w", err)
		}

		btRunner, err := NewBacktestRunner(ctx, *config)
		if err != nil {
			return nil, fmt.Errorf("failed to create Docker backtest runner: %w", err)
		}

		if err := btRunner.HealthCheck(ctx); err != nil {
			btRunner.Close()
			return nil, fmt.Errorf("Docker backtest runner health check failed: %w", err)
		}

		return btRunner, nil
	})

	// Register Docker config validator
	runner.RegisterConfigValidator(enum.RunnerDocker, func(configData map[string]interface{}) error {
		_, err := ParseConfig(configData)
		return err
	})
}
