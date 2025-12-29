package alert

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/alertrule"
	"volaticloud/internal/enum"
)

// Evaluator matches incoming events against alert rules
type Evaluator struct {
	dbClient *ent.Client
}

// NewEvaluator creates a new rule evaluator
func NewEvaluator(dbClient *ent.Client) *Evaluator {
	return &Evaluator{
		dbClient: dbClient,
	}
}

// FindMatchingRules finds all enabled rules that match the given event parameters
func (e *Evaluator) FindMatchingRules(
	ctx context.Context,
	ownerID string,
	alertType enum.AlertType,
	resourceType enum.AlertResourceType,
	resourceID *uuid.UUID,
) ([]*ent.AlertRule, error) {
	// Build query for matching rules
	query := e.dbClient.AlertRule.Query().
		Where(
			alertrule.OwnerIDEQ(ownerID),
			alertrule.AlertTypeEQ(alertType),
			alertrule.EnabledEQ(true),
			alertrule.DeletedAtIsNil(), // Soft delete check
		)

	// Match resource-specific or organization-level rules
	if resourceID != nil {
		query = query.Where(
			alertrule.Or(
				// Resource-specific rule (e.g., specific bot)
				alertrule.And(
					alertrule.ResourceTypeEQ(resourceType),
					alertrule.ResourceIDEQ(*resourceID),
				),
				// Resource-type level rule (e.g., all bots)
				alertrule.And(
					alertrule.ResourceTypeEQ(resourceType),
					alertrule.ResourceIDIsNil(),
				),
				// Organization-level rule (applies to all resources)
				alertrule.ResourceTypeEQ(enum.AlertResourceTypeOrganization),
			),
		)
	} else {
		// Organization-level event, match org-level rules only
		query = query.Where(
			alertrule.Or(
				alertrule.ResourceTypeEQ(resourceType),
				alertrule.ResourceTypeEQ(enum.AlertResourceTypeOrganization),
			),
			alertrule.ResourceIDIsNil(),
		)
	}

	return query.All(ctx)
}

// CheckCooldown checks if the rule is in cooldown period
// Returns true if alert should be suppressed
func (e *Evaluator) CheckCooldown(rule *ent.AlertRule) bool {
	if rule.LastTriggeredAt == nil {
		return false
	}

	cooldownDuration := time.Duration(rule.CooldownMinutes) * time.Minute
	cooldownExpires := rule.LastTriggeredAt.Add(cooldownDuration)

	return time.Now().Before(cooldownExpires)
}

// UpdateLastTriggered updates the last_triggered_at timestamp for a rule
func (e *Evaluator) UpdateLastTriggered(ctx context.Context, ruleID uuid.UUID) error {
	return e.dbClient.AlertRule.UpdateOneID(ruleID).
		SetLastTriggeredAt(time.Now()).
		Exec(ctx)
}

// EvaluateStatusConditions checks if the status change matches the rule conditions
func (e *Evaluator) EvaluateStatusConditions(conditions map[string]interface{}, newStatus string) bool {
	if conditions == nil {
		// No conditions means match all
		return true
	}

	triggerOnRaw, ok := conditions["trigger_on"]
	if !ok {
		return true
	}

	// Parse trigger_on as []string
	var triggerOn []string
	switch v := triggerOnRaw.(type) {
	case []string:
		triggerOn = v
	case []interface{}:
		for _, item := range v {
			if s, ok := item.(string); ok {
				triggerOn = append(triggerOn, s)
			}
		}
	default:
		// Try JSON unmarshal
		data, err := json.Marshal(triggerOnRaw)
		if err != nil {
			return true
		}
		if err := json.Unmarshal(data, &triggerOn); err != nil {
			return true
		}
	}

	// Check if newStatus is in trigger_on list
	for _, status := range triggerOn {
		if status == newStatus {
			return true
		}
	}

	return false
}

// EvaluateProfitLossConditions checks if the trade matches profit/loss conditions
func (e *Evaluator) EvaluateProfitLossConditions(conditions map[string]interface{}, profitRatio float64) bool {
	if conditions == nil {
		return true
	}

	thresholdRaw, ok := conditions["threshold_percent"]
	if !ok {
		return true
	}

	threshold, ok := thresholdRaw.(float64)
	if !ok {
		return true
	}

	directionRaw := conditions["direction"]
	direction, _ := directionRaw.(string)
	if direction == "" {
		direction = "both"
	}

	profitPercent := profitRatio * 100

	switch direction {
	case "profit":
		return profitPercent >= threshold
	case "loss":
		return profitPercent <= -threshold
	case "both":
		return profitPercent >= threshold || profitPercent <= -threshold
	default:
		return false
	}
}

// EvaluateDrawdownConditions checks if drawdown exceeds threshold
func (e *Evaluator) EvaluateDrawdownConditions(conditions map[string]interface{}, currentDrawdown float64) bool {
	if conditions == nil {
		return true
	}

	thresholdRaw, ok := conditions["max_drawdown_percent"]
	if !ok {
		return true
	}

	threshold, ok := thresholdRaw.(float64)
	if !ok {
		return true
	}

	return currentDrawdown >= threshold
}

// FilterByRecipients removes rules that have no recipients configured
func (e *Evaluator) FilterByRecipients(rules []*ent.AlertRule) []*ent.AlertRule {
	filtered := make([]*ent.AlertRule, 0, len(rules))
	for _, rule := range rules {
		if len(rule.Recipients) > 0 {
			filtered = append(filtered, rule)
		} else {
			log.Printf("Skipping rule %s: no recipients configured", rule.ID)
		}
	}
	return filtered
}

// FilterByBotMode removes rules that don't match the given bot trading mode
func (e *Evaluator) FilterByBotMode(rules []*ent.AlertRule, botMode string) []*ent.AlertRule {
	if botMode == "" {
		// If bot mode is not provided (e.g., for non-bot resources), include all rules
		return rules
	}

	filtered := make([]*ent.AlertRule, 0, len(rules))
	for _, rule := range rules {
		if rule.BotModeFilter.MatchesBotMode(botMode) {
			filtered = append(filtered, rule)
		} else {
			log.Printf("Skipping rule %s: bot mode filter %s doesn't match bot mode %s",
				rule.ID, rule.BotModeFilter, botMode)
		}
	}
	return filtered
}
