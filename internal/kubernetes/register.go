package kubernetes

import (
	"context"
	"fmt"

	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

func init() {
	// Register Kubernetes runtime creator
	runner.RegisterRuntimeCreator(enum.RunnerKubernetes, func(ctx context.Context, configData map[string]interface{}) (runner.Runtime, error) {
		config, err := ParseConfig(configData)
		if err != nil {
			return nil, fmt.Errorf("failed to parse Kubernetes config: %w", err)
		}

		runtime, err := NewRuntime(ctx, config)
		if err != nil {
			return nil, fmt.Errorf("failed to create Kubernetes runtime: %w", err)
		}

		if err := runtime.HealthCheck(ctx); err != nil {
			runtime.Close()
			return nil, fmt.Errorf("kubernetes runtime health check failed: %w", err)
		}

		return runtime, nil
	})

	// Register Kubernetes backtest runner creator
	runner.RegisterBacktestRunnerCreator(enum.RunnerKubernetes, func(ctx context.Context, configData map[string]interface{}) (runner.BacktestRunner, error) {
		config, err := ParseConfig(configData)
		if err != nil {
			return nil, fmt.Errorf("failed to parse Kubernetes config: %w", err)
		}

		btRunner, err := NewBacktestRunner(ctx, config)
		if err != nil {
			return nil, fmt.Errorf("failed to create Kubernetes backtest runner: %w", err)
		}

		if err := btRunner.HealthCheck(ctx); err != nil {
			btRunner.Close()
			return nil, fmt.Errorf("kubernetes backtest runner health check failed: %w", err)
		}

		return btRunner, nil
	})

	// Register Kubernetes config validator
	runner.RegisterConfigValidator(enum.RunnerKubernetes, func(configData map[string]interface{}) error {
		_, err := ParseConfig(configData)
		return err
	})
}
