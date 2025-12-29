package alert

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"volaticloud/internal/ent"
)

// Service provides alert management operations
type Service struct {
	dbClient *ent.Client
}

// NewService creates a new alert service
func NewService(dbClient *ent.Client) *Service {
	return &Service{
		dbClient: dbClient,
	}
}

// CreateRule creates a new alert rule
func (s *Service) CreateRule(ctx context.Context, input ent.CreateAlertRuleInput) (*ent.AlertRule, error) {
	rule, err := s.dbClient.AlertRule.Create().SetInput(input).Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert rule: %w", err)
	}

	return rule, nil
}

// UpdateRule updates an existing alert rule
func (s *Service) UpdateRule(ctx context.Context, ruleID uuid.UUID, input ent.UpdateAlertRuleInput) (*ent.AlertRule, error) {
	updated, err := s.dbClient.AlertRule.UpdateOneID(ruleID).SetInput(input).Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, fmt.Errorf("alert rule not found")
		}
		return nil, fmt.Errorf("failed to update alert rule: %w", err)
	}

	return updated, nil
}

// ToggleRule enables or disables an alert rule
func (s *Service) ToggleRule(ctx context.Context, ruleID uuid.UUID, enabled bool) (*ent.AlertRule, error) {
	updated, err := s.dbClient.AlertRule.UpdateOneID(ruleID).
		SetEnabled(enabled).
		Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, fmt.Errorf("alert rule not found")
		}
		return nil, fmt.Errorf("failed to update alert rule: %w", err)
	}

	return updated, nil
}

// DeleteRule soft-deletes an alert rule
func (s *Service) DeleteRule(ctx context.Context, ruleID uuid.UUID) error {
	err := s.dbClient.AlertRule.DeleteOneID(ruleID).Exec(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return fmt.Errorf("alert rule not found")
		}
		return fmt.Errorf("failed to delete alert rule: %w", err)
	}

	return nil
}
