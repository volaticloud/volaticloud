package alert

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"volaticloud/internal/auth"
	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
	"volaticloud/internal/keycloak"
)

// Service provides alert management operations
type Service struct {
	dbClient  *ent.Client
	umaClient keycloak.UMAClientInterface
}

// NewService creates a new alert service
func NewService(dbClient *ent.Client, umaClient keycloak.UMAClientInterface) *Service {
	return &Service{
		dbClient:  dbClient,
		umaClient: umaClient,
	}
}

// getEffectiveResourceID determines the resource ID to check permissions against
// For organization-scoped alerts, use ownerID; for resource-specific, use resourceID
func getEffectiveResourceID(resourceType enum.AlertResourceType, resourceID *uuid.UUID, ownerID string) string {
	if resourceType == enum.AlertResourceTypeOrganization {
		return ownerID
	}
	if resourceID != nil {
		return resourceID.String()
	}
	return ownerID
}

// checkAlertPermission verifies that the user has the specified permission on the alert's resource
func (s *Service) checkAlertPermission(ctx context.Context, resourceType enum.AlertResourceType, resourceID *uuid.UUID, ownerID, scope string) error {
	userCtx, err := auth.GetUserContext(ctx)
	if err != nil {
		return fmt.Errorf("authentication required: %w", err)
	}

	if s.umaClient == nil {
		// If UMA client is not configured, allow (dev mode or testing)
		return nil
	}

	effectiveResourceID := getEffectiveResourceID(resourceType, resourceID, ownerID)

	hasPermission, err := s.umaClient.CheckPermission(ctx, userCtx.RawToken, effectiveResourceID, scope)
	if err != nil {
		return fmt.Errorf("permission check failed: %w", err)
	}

	if !hasPermission {
		return fmt.Errorf("you don't have %q access to create/modify alert rules on resource %q", scope, effectiveResourceID)
	}

	return nil
}

// CreateRule creates a new alert rule
func (s *Service) CreateRule(ctx context.Context, input ent.CreateAlertRuleInput) (*ent.AlertRule, error) {
	// Check permission on the target resource
	if err := s.checkAlertPermission(ctx, input.ResourceType, input.ResourceID, input.OwnerID, "create-alert-rule"); err != nil {
		return nil, err
	}

	rule, err := s.dbClient.AlertRule.Create().SetInput(input).Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert rule: %w", err)
	}

	return rule, nil
}

// UpdateRule updates an existing alert rule
func (s *Service) UpdateRule(ctx context.Context, ruleID uuid.UUID, input ent.UpdateAlertRuleInput) (*ent.AlertRule, error) {
	// Fetch existing rule to get resource info for permission check
	rule, err := s.dbClient.AlertRule.Get(ctx, ruleID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, fmt.Errorf("alert rule not found")
		}
		return nil, fmt.Errorf("failed to fetch alert rule: %w", err)
	}

	// Check permission on the rule's resource
	if err := s.checkAlertPermission(ctx, rule.ResourceType, rule.ResourceID, rule.OwnerID, "update-alert-rule"); err != nil {
		return nil, err
	}

	updated, err := s.dbClient.AlertRule.UpdateOneID(ruleID).SetInput(input).Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update alert rule: %w", err)
	}

	return updated, nil
}

// ToggleRule enables or disables an alert rule
func (s *Service) ToggleRule(ctx context.Context, ruleID uuid.UUID, enabled bool) (*ent.AlertRule, error) {
	// Fetch existing rule to get resource info for permission check
	rule, err := s.dbClient.AlertRule.Get(ctx, ruleID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, fmt.Errorf("alert rule not found")
		}
		return nil, fmt.Errorf("failed to fetch alert rule: %w", err)
	}

	// Check permission on the rule's resource (toggle is an update operation)
	if err := s.checkAlertPermission(ctx, rule.ResourceType, rule.ResourceID, rule.OwnerID, "update-alert-rule"); err != nil {
		return nil, err
	}

	updated, err := s.dbClient.AlertRule.UpdateOneID(ruleID).
		SetEnabled(enabled).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update alert rule: %w", err)
	}

	return updated, nil
}

// DeleteRule soft-deletes an alert rule
func (s *Service) DeleteRule(ctx context.Context, ruleID uuid.UUID) error {
	// Fetch existing rule to get resource info for permission check
	rule, err := s.dbClient.AlertRule.Get(ctx, ruleID)
	if err != nil {
		if ent.IsNotFound(err) {
			return fmt.Errorf("alert rule not found")
		}
		return fmt.Errorf("failed to fetch alert rule: %w", err)
	}

	// Check permission on the rule's resource
	if err := s.checkAlertPermission(ctx, rule.ResourceType, rule.ResourceID, rule.OwnerID, "delete-alert-rule"); err != nil {
		return err
	}

	err = s.dbClient.AlertRule.DeleteOneID(ruleID).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete alert rule: %w", err)
	}

	return nil
}
