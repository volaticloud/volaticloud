package alert

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"volaticloud/internal/alert/channel"
	"volaticloud/internal/backtest"
	"volaticloud/internal/bot"
	"volaticloud/internal/ent"
	"volaticloud/internal/enum"
)

// Dispatcher routes alerts to appropriate channels and creates audit records
type Dispatcher struct {
	dbClient     *ent.Client
	emailChannel channel.Channel
	evaluator    *Evaluator
	batcher      *Batcher
	templateFn   func(alertType enum.AlertType, data map[string]interface{}) (subject, body, htmlBody string)
}

// NewDispatcher creates a new alert dispatcher
func NewDispatcher(dbClient *ent.Client, evaluator *Evaluator) *Dispatcher {
	return &Dispatcher{
		dbClient:   dbClient,
		evaluator:  evaluator,
		templateFn: defaultTemplate,
	}
}

// SetEmailChannel sets the email channel for delivery
func (d *Dispatcher) SetEmailChannel(ch channel.Channel) {
	d.emailChannel = ch
}

// SetBatcher sets the batcher for batched delivery mode
func (d *Dispatcher) SetBatcher(batcher *Batcher) {
	d.batcher = batcher
}

// SetTemplateFunc sets a custom template function for building alert content
func (d *Dispatcher) SetTemplateFunc(fn func(alertType enum.AlertType, data map[string]interface{}) (subject, body, htmlBody string)) {
	d.templateFn = fn
}

// Dispatch sends an alert for a matched rule
func (d *Dispatcher) Dispatch(ctx context.Context, rule *ent.AlertRule, eventData map[string]interface{}) error {
	// Check cooldown
	if d.evaluator.CheckCooldown(rule) {
		log.Printf("Alert suppressed (cooldown): rule=%s", rule.ID)
		return d.createEventRecord(ctx, rule, eventData, enum.AlertEventStatusSuppressed, "Rate limited by cooldown")
	}

	// Check if email channel is configured
	if d.emailChannel == nil {
		log.Printf("Alert suppressed (no email channel): rule=%s", rule.ID)
		return d.createEventRecord(ctx, rule, eventData, enum.AlertEventStatusSuppressed, "Email channel not configured")
	}

	// Build alert content
	subject, body, htmlBody := d.templateFn(rule.AlertType, eventData)

	// Create alert
	alert := Alert{
		ID:           uuid.New(),
		RuleID:       rule.ID,
		ChannelType:  channel.ChannelTypeEmail,
		AlertType:    rule.AlertType,
		Severity:     rule.Severity,
		ResourceType: rule.ResourceType,
		ResourceID:   rule.ResourceID,
		Subject:      subject,
		Body:         body,
		HTMLBody:     htmlBody,
		Recipients:   rule.Recipients,
		Context:      eventData,
		CreatedAt:    time.Now(),
	}

	// Route based on delivery mode
	if rule.DeliveryMode == enum.AlertDeliveryModeBatched && d.batcher != nil {
		d.batcher.Add(alert)
		log.Printf("Alert queued for batch: rule=%s", rule.ID)
		return nil
	}

	// Immediate delivery
	return d.sendImmediate(ctx, rule, alert, eventData)
}

// sendImmediate sends an alert immediately through the email channel
func (d *Dispatcher) sendImmediate(ctx context.Context, rule *ent.AlertRule, alert Alert, eventData map[string]interface{}) error {
	// Create message
	msg := channel.Message{
		Subject:    alert.Subject,
		Body:       alert.Body,
		HTMLBody:   alert.HTMLBody,
		Recipients: alert.Recipients,
		Metadata: map[string]interface{}{
			"alert_id":   alert.ID.String(),
			"rule_id":    alert.RuleID.String(),
			"alert_type": string(alert.AlertType),
			"severity":   string(alert.Severity),
		},
	}

	// Send through email channel
	if err := d.emailChannel.Send(ctx, msg); err != nil {
		log.Printf("Alert delivery failed: rule=%s error=%v", rule.ID, err)
		if createErr := d.createEventRecord(ctx, rule, eventData, enum.AlertEventStatusFailed, err.Error()); createErr != nil {
			log.Printf("Failed to create event record: %v", createErr)
		}
		return err
	}

	// Update last triggered
	if err := d.evaluator.UpdateLastTriggered(ctx, rule.ID); err != nil {
		log.Printf("Failed to update last_triggered_at: %v", err)
	}

	// Create success event record
	return d.createEventRecord(ctx, rule, eventData, enum.AlertEventStatusSent, "")
}

// SendBatch sends a batch of alerts as a digest
func (d *Dispatcher) SendBatch(ctx context.Context, alerts []Alert) error {
	if len(alerts) == 0 {
		return nil
	}

	if d.emailChannel == nil {
		log.Printf("Batch delivery skipped: no email channel configured")
		return nil
	}

	// Group alerts by recipients
	groups := d.groupAlerts(alerts)

	for _, group := range groups {
		// Build digest message
		subject := fmt.Sprintf("VolatiCloud Alert Digest: %d alerts", len(group.alerts))
		body, htmlBody := d.buildDigest(group.alerts)

		msg := channel.Message{
			Subject:    subject,
			Body:       body,
			HTMLBody:   htmlBody,
			Recipients: group.recipients,
			Metadata: map[string]interface{}{
				"batch_size": len(group.alerts),
			},
		}

		if err := d.emailChannel.Send(ctx, msg); err != nil {
			log.Printf("Batch delivery failed: %v", err)
			continue
		}

		log.Printf("Batch sent: %d alerts to %v", len(group.alerts), group.recipients)
	}

	return nil
}

// alertGroup holds grouped alerts with their metadata
type alertGroup struct {
	recipients []string
	alerts     []Alert
}

// groupAlerts groups alerts by recipients
func (d *Dispatcher) groupAlerts(alerts []Alert) []alertGroup {
	// Use a map with string key for grouping
	groups := make(map[string]*alertGroup)

	for _, alert := range alerts {
		// Create a unique key from recipients
		key := fmt.Sprintf("%v", alert.Recipients)
		if g, ok := groups[key]; ok {
			g.alerts = append(g.alerts, alert)
		} else {
			groups[key] = &alertGroup{
				recipients: alert.Recipients,
				alerts:     []Alert{alert},
			}
		}
	}

	// Convert map to slice
	result := make([]alertGroup, 0, len(groups))
	for _, g := range groups {
		result = append(result, *g)
	}
	return result
}

// buildDigest creates a digest message from multiple alerts
func (d *Dispatcher) buildDigest(alerts []Alert) (body, htmlBody string) {
	body = "Alert Digest:\n\n"
	htmlBody = "<h2>Alert Digest</h2><ul>"

	for _, alert := range alerts {
		body += fmt.Sprintf("- [%s] %s\n", alert.Severity, alert.Subject)
		htmlBody += fmt.Sprintf("<li><strong>[%s]</strong> %s</li>", alert.Severity, alert.Subject)
	}

	htmlBody += "</ul>"
	return body, htmlBody
}

// createEventRecord creates an AlertEvent audit record
func (d *Dispatcher) createEventRecord(
	ctx context.Context,
	rule *ent.AlertRule,
	eventData map[string]interface{},
	status enum.AlertEventStatus,
	errorMessage string,
) error {
	subject, body, _ := d.templateFn(rule.AlertType, eventData)

	builder := d.dbClient.AlertEvent.Create().
		SetRuleID(rule.ID).
		SetStatus(status).
		SetAlertType(rule.AlertType).
		SetSeverity(rule.Severity).
		SetSubject(subject).
		SetBody(body).
		SetContext(eventData).
		SetRecipients(rule.Recipients).
		SetChannelType("email"). // Always email (simplified from multi-channel design)
		SetResourceType(rule.ResourceType).
		SetOwnerID(rule.OwnerID)

	if rule.ResourceID != nil {
		builder.SetResourceID(*rule.ResourceID)
	}

	if status == enum.AlertEventStatusSent {
		builder.SetSentAt(time.Now())
	}

	if errorMessage != "" {
		builder.SetErrorMessage(errorMessage)
	}

	_, err := builder.Save(ctx)
	return err
}

// defaultTemplate uses Hermes templates from domain packages to generate beautiful emails.
func defaultTemplate(alertType enum.AlertType, data map[string]interface{}) (subject, body, htmlBody string) {
	switch alertType {
	// Bot-related alerts (from internal/bot package)
	case enum.AlertTypeStatusChange:
		return bot.StatusChangeTemplate(data)

	case enum.AlertTypeTradeOpened:
		return bot.TradeOpenedTemplate(data)

	case enum.AlertTypeTradeClosed:
		return bot.TradeClosedTemplate(data)

	case enum.AlertTypeLargeProfitLoss:
		return bot.LargeProfitLossTemplate(data)

	case enum.AlertTypeConnectionIssue:
		return bot.ConnectionIssueTemplate(data)

	// Backtest-related alerts (from internal/backtest package)
	case enum.AlertTypeBacktestCompleted:
		return backtest.CompletedTemplate(data)

	case enum.AlertTypeBacktestFailed:
		return backtest.FailedTemplate(data)

	default:
		// Fallback for unknown alert types
		subject = fmt.Sprintf("VolatiCloud Alert: %s", alertType)
		body = fmt.Sprintf("Alert type: %s", alertType)
		htmlBody = fmt.Sprintf("<p>Alert type: %s</p>", alertType)
		return subject, body, htmlBody
	}
}
